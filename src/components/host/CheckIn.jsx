"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/host/api";
import { useAsync } from "@/lib/host/useAsync";
import { formatWhen } from "@/lib/host/format";
import { Button, EmptyState, ErrorState, Field, Notice, PageHeader, Skeleton } from "./ui";
import { RequireHost } from "./HostAuth";
import styles from "./CheckIn.module.css";

const DUPLICATE_WINDOW_MS = 3000;
const RESULT_MS = 4000;

const OUTCOMES = {
  valid: { tone: "valid", glyph: "✓", title: "Valid" },
  already_used: { tone: "invalid", glyph: "✕", title: "Already used" },
  wrong_event: { tone: "invalid", glyph: "✕", title: "Wrong event" },
  invalid: { tone: "invalid", glyph: "✕", title: "Invalid ticket" },
};

function ResultPanel({ result, onClose }) {
  const outcome = result.kind === "error" ? { tone: "warn", glyph: "!", title: "Couldn't check" } : OUTCOMES[result.result] ?? OUTCOMES.invalid;
  const detail =
    result.kind === "error"
      ? result.message
      : result.result === "valid"
        ? `${result.attendee_name || "Guest"} · ${result.ticket_name ?? "Ticket"} · admit ${result.quantity ?? 1}`
        : result.result === "already_used"
          ? `${result.attendee_name || "This ticket"} checked in at ${formatWhen(result.checked_in_at)}`
          : result.result === "wrong_event"
            ? "This ticket is for a different event."
            : "We don't recognise this QR code.";

  return (
    <button type="button" className={`${styles.result} ${styles[outcome.tone]}`} onClick={onClose} role="status" aria-live="assertive">
      <span className={styles.glyph} aria-hidden="true">{outcome.glyph}</span>
      <strong>{outcome.title}</strong>
      <span>{detail}</span>
      <small>Tap to scan the next ticket</small>
    </button>
  );
}

function Screen({ eventId }) {
  const eventState = useAsync(useCallback(() => api.getEvent(eventId), [eventId]));
  const videoRef = useRef(null);
  const lastScan = useRef({ code: "", at: 0 });
  const busy = useRef(false);

  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState(null);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [guests, setGuests] = useState({ forQuery: "", items: [] });

  const supported = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

  const check = useCallback(
    async (code) => {
      if (busy.current) return;
      const now = Date.now();
      if (code === lastScan.current.code && now - lastScan.current.at < DUPLICATE_WINDOW_MS) return;
      lastScan.current = { code, at: now };
      busy.current = true;
      try {
        const res = await api.scan(code, eventId);
        setResult(res);
        if (res.result === "valid") setCount((c) => c + 1);
        navigator.vibrate?.(res.result === "valid" ? 80 : [120, 60, 120]);
      } catch (err) {
        // A failed request is not an "invalid ticket": tell staff to retry instead of turning guests away.
        setResult({ kind: "error", message: err.status === 0 ? "No connection. Try this ticket again." : err.message });
        lastScan.current = { code: "", at: 0 };
      } finally {
        busy.current = false;
      }
    },
    [eventId],
  );

  async function startCamera() {
    setCameraError("");
    try {
      setStream(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }));
    } catch {
      setCameraError("We couldn't open the camera. Allow camera access in your browser, or search for guests below.");
    }
  }

  // Attach the stream and look for QR codes a few times a second.
  useEffect(() => {
    const video = videoRef.current;
    if (!stream || !video) return;
    video.srcObject = stream;
    video.play().catch(() => {});
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const timer = setInterval(async () => {
      if (busy.current || video.readyState < 2) return;
      try {
        const [code] = await detector.detect(video);
        if (code?.rawValue) check(code.rawValue);
      } catch {
        // a frame that can't be read is simply skipped
      }
    }, 300);
    return () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream, check]);

  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), RESULT_MS);
    return () => clearTimeout(t);
  }, [result]);

  // Manual fallback: search guests by name or phone, then check them in.
  useEffect(() => {
    const q = search.trim();
    const t = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(t);
  }, [search]);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (query.length < 2) return;
    let live = true;
    api
      .listBookings(eventId, { q: query, limit: 20 })
      .then(({ items }) => live && setGuests({ forQuery: query, items }))
      .catch((err) => live && setGuests({ forQuery: query, items: [], message: err.message }));
    return () => {
      live = false;
    };
  }, [eventId, query, reloadKey]);

  // Idle and loading are derived from the query, so the effect only sets state when a response arrives.
  const searching = query.length >= 2;
  const guestState = !searching ? "idle" : guests.forQuery !== query ? "loading" : guests.message ? "error" : "ready";
  const guestItems = searching && guests.forQuery === query ? guests.items : [];

  async function checkInGuest(guest) {
    lastScan.current = { code: "", at: 0 };
    await check(guest.qr_token);
    setReloadKey((k) => k + 1);
  }

  if (eventState.loading && !eventState.data) return <Skeleton lines={4} label="Loading event" />;
  if (eventState.error && !eventState.data) return <ErrorState error={eventState.error} onRetry={eventState.reload} />;
  const event = eventState.data;
  if (event.status !== "live") {
    return <EmptyState title="Check-in opens when the event is live" text={`This event is ${event.status.replace("_", " ")}.`} action={<Button href={`/host/events/${eventId}`}>Back to event</Button>} />;
  }

  return (
    <>
      <PageHeader title="Check-in" text={event.title} actions={<Button variant="secondary" href={`/host/events/${eventId}`}>Done</Button>} />
      {result && <ResultPanel result={result} onClose={() => setResult(null)} />}

      <section className={styles.scanner} aria-label="QR scanner">
        {stream ? (
          <video ref={videoRef} className={styles.video} playsInline muted aria-label="Camera view" />
        ) : (
          <div className={styles.idle}>
            <p>{supported ? "Point the camera at a guest's QR ticket." : "This browser can't scan QR codes. Search for guests below instead."}</p>
            {supported && <Button onClick={startCamera}>Start camera</Button>}
          </div>
        )}
        {cameraError && <Notice tone="error">{cameraError}</Notice>}
        <p className={styles.count}>Checked in this session: <strong>{count}</strong></p>
      </section>

      <section className={styles.manual} aria-labelledby="manual-title">
        <h2 id="manual-title">Can&apos;t scan?</h2>
        <Field label="Find a guest" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone number" />
        {guestState === "loading" && <Skeleton lines={2} label="Searching" />}
        {guestState === "error" && <Notice tone="error">{guests.message}</Notice>}
        {guestState === "ready" && !guestItems.length && <Notice>No guest matches &ldquo;{query}&rdquo;.</Notice>}
        <ul className={styles.guests}>
          {guestItems.map((g) => (
            <li key={g.id}>
              <div>
                <strong>{g.attendee_name || "Guest"}</strong>
                <span>{g.ticket_name} · {g.quantity} {g.quantity === 1 ? "person" : "people"}</span>
              </div>
              {g.checked_in_at ? <span className={styles.done}>Checked in</span> : <Button variant="secondary" onClick={() => checkInGuest(g)}>Check in</Button>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function CheckIn({ eventId }) {
  return (
    <RequireHost>
      <Screen eventId={eventId} />
    </RequireHost>
  );
}
