import asyncio
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel

from app.deps import get_current_user
from app.models import User
from app.ratelimit import rate_limit
from app.services.images import MAX_BYTES, process_image
from app.services.storage import get_storage

router = APIRouter(prefix="/uploads", tags=["uploads"])


class UploadOut(BaseModel):
    url: str | None  # null for private documents
    key: str


@router.post("/image", response_model=UploadOut, status_code=201, dependencies=[Depends(rate_limit("upload", 40, 600))])
async def upload_image(
    file: Annotated[UploadFile, File(description="JPG, PNG or WebP, max 5 MB")],
    kind: Annotated[Literal["cover", "gallery", "logo", "document"], Query()] = "gallery",
    user: User = Depends(get_current_user),
):
    """Validate, resize (cover is cropped to 16:10, logo to a square), strip metadata and store.

    `kind=document` (PAN/VAT/ID photos) is stored privately: no public URL is returned.
    """
    from app.errors import bad_request

    data = await file.read(MAX_BYTES + 1)  # never buffer more than the limit
    if not data:
        raise bad_request("image_empty", "That file is empty.")
    processed = await asyncio.to_thread(process_image, data, kind)
    public = kind != "document"
    key = f"{'public' if public else 'private'}/{kind}/{uuid.uuid4().hex}.webp"
    url = await get_storage().put(key, processed, "image/webp", public)
    return UploadOut(url=url if public else None, key=key)
