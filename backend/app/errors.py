"""Consistent error JSON for every failure:

    {"error": {"code": "event_not_found", "message": "...", "details": [...]}}
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: Any = None, headers: dict | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details
        self.headers = headers or {}


def bad_request(code: str, message: str, details: Any = None) -> AppError:
    return AppError(400, code, message, details)


def unauthorized(message: str = "Please sign in to continue.") -> AppError:
    return AppError(401, "unauthorized", message, headers={"WWW-Authenticate": "Bearer"})


def forbidden(message: str = "You don't have permission to do that.") -> AppError:
    return AppError(403, "forbidden", message)


def not_found(what: str = "That") -> AppError:
    return AppError(404, "not_found", f"{what} was not found.")


def conflict(code: str, message: str) -> AppError:
    return AppError(409, code, message)


def _body(code: str, message: str, details: Any = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details}}


def _plain_message(err: dict) -> str:
    """Turn a Pydantic error into a sentence a host can act on."""
    field = ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path"))
    kind = err["type"]
    ctx = err.get("ctx") or {}
    if kind == "missing":
        text = "is required"
    elif kind in ("string_too_short",):
        text = f"needs at least {ctx.get('min_length')} characters"
    elif kind in ("string_too_long",):
        text = f"can be at most {ctx.get('max_length')} characters"
    elif kind in ("greater_than_equal", "greater_than"):
        text = "is too small"
    elif kind in ("less_than_equal", "less_than"):
        text = "is too large"
    elif kind == "value_error":
        text = str(err["msg"]).removeprefix("Value error, ")
    else:
        text = err["msg"][0].lower() + err["msg"][1:]
    return f"{field} {text}".strip() if field else text[:1].upper() + text[1:]


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.code, exc.message, exc.details), status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path")), "message": _plain_message(e)}
            for e in exc.errors()
        ]
        message = details[0]["message"] if details else "Some details are not valid."
        return JSONResponse(_body("validation_error", message, details), status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return JSONResponse(_body(code, str(exc.detail)), status_code=exc.status_code, headers=getattr(exc, "headers", None))

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        import structlog

        structlog.get_logger().exception("unhandled_error", error=repr(exc))
        return JSONResponse(_body("internal_error", "Something went wrong on our side. Please try again."), status_code=500)
