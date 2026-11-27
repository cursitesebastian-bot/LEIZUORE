"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/host/api";
import { useAsync } from "@/lib/host/useAsync";
import { CATEGORIES } from "@/lib/host/format";
import { AsyncView, Button, EmptyState, Field, Notice, Segmented, Skeleton } from "./ui";
import { RequireHost } from "./HostAuth";
import ImageUpload from "./ImageUpload";
import EventPreview from "./EventPreview";
import { blankTicket, checklist, emptyForm, fromEvent, MAX_TICKET_TYPES, STEPS, toPayload, validateStep } from "./eventForm";
import styles from "./EventWizard.module.css";

const backupKey = (id) => `zoure.host.draft.${id ?? "new"}`;
const readBackup = () => {
  try {
    return JSON.parse(window.localStorage.getItem(backupKey()) || "null");
  } catch {
    return null;
  }
};

// ------------------------------------------------------------------ steps
function Basics({ form, set, errors }) {
  const gallery = form.gallery_urls;
  return (
    <>
      <Field label="Event name" value={form.title} onChange={(e) => set({ title: e.target.value })} error={errors.title} maxLength={140} placeholder="Saturday sunrise run" required />
      <Segmented label="Category" options={CATEGORIES} value={form.category} onChange={(category) => set({ category })} />
      {errors.category && <p className={styles.fieldError} role="alert">{errors.category}</p>}
      <Field label="Description" multiline maxLength={5000} value={form.description} onChange={(e) => set({ description: e.target.value })} hint="What to expect, who it's for, what to bring. At least 20 characters." />
      <ImageUpload label="Cover image" kind="cover" value={form.cover_image_url} onChange={(cover_image_url) => set({ cover_image_url })} hint="Cropped to the card shape (16:10). JPG, PNG or WebP, up to 5 MB." />
      <div className={styles.gallery}>
        {gallery.map((url, i) => (
          <div key={url} className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Gallery image ${i + 1}`} />
            <button type="button" aria-label={`Remove gallery image ${i + 1}`} onClick={() => set({ gallery_urls: gallery.filter((u) => u !== url) })}>×</button>
          </div>
        ))}
      </div>
      {gallery.length < 5 && (
        <ImageUpload label={`Gallery (${gallery.length}/5)`} kind="gallery" value={null} onChange={(url) => url && set({ gallery_urls: [...gallery, url] })} hint="Optional. Up to 5 more photos." />
      )}
    </>
  );
}

function When({ form, set, errors }) {
  return (
    <>
      <p className={styles.tz}>All times are Nepal time.</p>
      <div className={styles.two}>
        <Field label="Starts" type="datetime-local" value={form.starts_at} onChange={(e) => set({ starts_at: e.target.value })} />
        <Field label="Ends" type="datetime-local" value={form.ends_at} onChange={(e) => set({ ends_at: e.target.value })} error={errors.ends_at} />
      </div>
      <Segmented label="Does it repeat?" options={[{ value: false, label: "Just once" }, { value: true, label: "Every week" }]} value={form.repeat} onChange={(repeat) => set({ repeat })} />
      <Field label="Registration closes (optional)" type="datetime-local" value={form.registration_deadline} onChange={(e) => set({ registration_deadline: e.target.value })} error={errors.registration_deadline} hint="Leave empty to allow bookings until the event starts." />
    </>
  );
}

function Where({ form, set, errors }) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  function locate() {
    if (!navigator.geolocation) return setGeoError("This browser can't share your location. Enter the coordinates below.");
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        set({ lat: +coords.latitude.toFixed(6), lng: +coords.longitude.toFixed(6) });
        setLocating(false);
      },
      () => {
        setGeoError("We couldn't get your location. Enter the coordinates below instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <>
      <Segmented label="Where is it?" options={[{ value: false, label: "In person" }, { value: true, label: "Online" }]} value={form.is_online} onChange={(is_online) => set({ is_online })} />
      {form.is_online ? (
        <Notice>Online events are shown without a map location and don&apos;t appear in &ldquo;near me&rdquo; results.</Notice>
      ) : (
        <>
          <Field label="Venue name" value={form.venue_name} onChange={(e) => set({ venue_name: e.target.value })} placeholder="Jawalakhel Ground" maxLength={160} />
          <Field label="Address" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Jawalakhel, Lalitpur" maxLength={300} />
          <div className={styles.pin}>
            <Button variant="secondary" loading={locating} onClick={locate}>Use my current location</Button>
            <p>{form.lat !== "" && form.lng !== "" ? `Pin set (${form.lat}, ${form.lng})` : "Stand at the venue and tap to drop a pin."}</p>
          </div>
          {geoError && <Notice tone="error">{geoError}</Notice>}
          <details className={styles.details}>
            <summary>Enter coordinates yourself</summary>
            <div className={styles.two}>
              <Field label="Latitude" inputMode="decimal" value={form.lat} onChange={(e) => set({ lat: e.target.value })} error={errors.lat} placeholder="27.6728" />
              <Field label="Longitude" inputMode="decimal" value={form.lng} onChange={(e) => set({ lng: e.target.value })} error={errors.lng} placeholder="85.3140" />
            </div>
          </details>
        </>
      )}
    </>
  );
}

function Tickets({ form, set, errors }) {
  const update = (key, patch) => set({ tickets: form.tickets.map((t) => (t.key === key ? { ...t, ...patch } : t)) });
  return (
    <>
      <Segmented label="Tickets" options={[{ value: false, label: "Free" }, { value: true, label: "Paid" }]} value={form.paid} onChange={(paid) => set({ paid })} />
      {form.paid && <Notice>Paid tickets are paid out after the event ends, and need a verified account to publish.</Notice>}
      {form.tickets.map((t, i) => {
        const te = errors[`ticket${i}`] ?? {};
        const locked = t.sold > 0;
        return (
          <fieldset key={t.key} className={styles.ticket}>
            <legend>Ticket type {i + 1}</legend>
            <Field label="Name" value={t.name} onChange={(e) => update(t.key, { name: e.target.value })} error={te.name} placeholder="General, VIP" maxLength={80} />
            <div className={styles.two}>
              {form.paid && (
                <Field label="Price (Rs)" inputMode="numeric" value={t.price} disabled={locked} onChange={(e) => update(t.key, { price: e.target.value.replace(/\D/g, "") })} error={te.price} hint={locked ? "Locked: this ticket already has bookings." : undefined} />
              )}
              <Field label="How many available" inputMode="numeric" value={t.capacity} onChange={(e) => update(t.key, { capacity: e.target.value.replace(/\D/g, "") })} error={te.capacity} />
              <Field label="Max per person" inputMode="numeric" value={t.max_per_user} onChange={(e) => update(t.key, { max_per_user: e.target.value.replace(/\D/g, "") })} />
            </div>
            <details className={styles.details}>
              <summary>Sales window (optional)</summary>
              <div className={styles.two}>
                <Field label="Sales start" type="datetime-local" value={t.sales_start} onChange={(e) => update(t.key, { sales_start: e.target.value })} />
                <Field label="Sales end" type="datetime-local" value={t.sales_end} onChange={(e) => update(t.key, { sales_end: e.target.value })} error={te.sales_end} />
              </div>
            </details>
            {form.tickets.length > 1 && !locked && (
              <Button variant="quiet" onClick={() => set({ tickets: form.tickets.filter((x) => x.key !== t.key) })}>Remove this ticket</Button>
            )}
          </fieldset>
        );
      })}
      {form.tickets.length < MAX_TICKET_TYPES && (
        <Button variant="secondary" onClick={() => set({ tickets: [...form.tickets, { ...blankTicket(), name: "" }] })}>Add ticket type</Button>
      )}
    </>
  );
}

// ------------------------------------------------------------------ wizard
function Wizard({ initial }) {
  const router = useRouter();
  const { data: organizer } = useAsync(useCallback(() => api.getOrganizer(), []));
  const [form, setForm] = useState(() => (initial.id ? fromEvent(initial.event) : (readBackup() ?? emptyForm())));
  const [restored] = useState(() => !initial.id && !!readBackup());
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [saveState, setSaveState] = useState({ state: "idle" });
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  const idRef = useRef(initial.id ?? null);
  const dirtyRef = useRef(false);
  const status = initial.event?.status ?? "draft";
  // Live and in-review events are only saved on request, because key edits send them back to review.
  const autosave = ["draft", "rejected"].includes(status);

  const set = useCallback((patch) => {
    dirtyRef.current = true;
    setForm((f) => ({ ...f, ...patch }));
  }, []);

  const persist = useCallback(async (f) => {
    const payload = toPayload(f);
    if (!idRef.current && (payload.title.length < 3 || !payload.category)) return { skipped: true };
    if (idRef.current) {
      if (payload.title.length < 3) delete payload.title;
      if (!payload.category) delete payload.category;
    }
    dirtyRef.current = false;
    setSaveState({ state: "saving" });
    try {
      const event = idRef.current ? await api.updateEvent(idRef.current, payload) : await api.createEvent(payload);
      if (!idRef.current) {
        idRef.current = event.id;
        window.history.replaceState(null, "", `/host/events/${event.id}/edit`);
        window.localStorage.removeItem(backupKey());
      }
      // Remember server ids of new tickets so the next save updates them instead of duplicating.
      setForm((cur) =>
        cur.tickets.length === event.ticket_types.length
          ? { ...cur, tickets: cur.tickets.map((t, i) => ({ ...t, id: t.id ?? event.ticket_types[i].id, sold: event.ticket_types[i].sold })) }
          : cur,
      );
      setSaveState({ state: "saved", notice: event.notice });
      return { event };
    } catch (err) {
      dirtyRef.current = true;
      setSaveState({ state: "error", message: err.message });
      return { error: err };
    }
  }, []);

  // Autosave 1.2s after the last change; a copy stays on the phone in case the connection drops.
  useEffect(() => {
    if (!dirtyRef.current) return;
    window.localStorage.setItem(backupKey(idRef.current), JSON.stringify(form));
    if (!autosave) return;
    const timer = setTimeout(() => persist(form), 1200);
    return () => clearTimeout(timer);
  }, [form, autosave, persist]);

  useEffect(() => {
    const warn = (e) => dirtyRef.current && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function next() {
    const found = validateStep(step, form);
    setErrors(found);
    if (!Object.keys(found).length) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0 });
    }
  }

  async function saveNow() {
    const { event, error } = await persist(form);
    if (event) window.localStorage.removeItem(backupKey(idRef.current));
    return !error;
  }

  async function submit() {
    setSubmitError(null);
    setSubmitting(true);
    try {
      if (!(await saveNow())) return;
      await api.submitEvent(idRef.current);
      setDone("review");
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const missing = checklist(form, organizer?.verification_status === "verified");

  if (done) {
    return (
      <EmptyState
        title="Sent for review"
        text="Our team checks every event before it goes live. We'll message you as soon as it's approved or if we need a change."
        action={<Button href="/host/dashboard">Back to dashboard</Button>}
      />
    );
  }

  const Step = [Basics, When, Where, Tickets][step];

  return (
    <div className={styles.wizard}>
      <div className={styles.top}>
        <p className={styles.stepLabel}>Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
        <p className={styles.saved} role="status" aria-live="polite">
          {saveState.state === "saving" && "Saving…"}
          {saveState.state === "saved" && "Saved"}
          {saveState.state === "error" && "Couldn't save just now. Your changes are kept on this phone and we'll try again on your next edit."}
          {saveState.state === "idle" && (!initial.id && autosave ? "Saved as a draft once you add a name and category." : "")}
        </p>
      </div>
      <div className={styles.progress} role="progressbar" aria-label="Progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {restored && step === 0 && <Notice>We restored the draft you were working on.</Notice>}
      {status === "live" && <Notice>This event is live. Changing the date, venue or price sends it back to review and tells your attendees.</Notice>}
      {status === "in_review" && <Notice>This event is in review. Saving changes to the date, venue or price restarts the review.</Notice>}
      {status === "rejected" && initial.event.rejection_reason && <Notice tone="error">Rejected: {initial.event.rejection_reason}</Notice>}
      {saveState.notice && <Notice>{saveState.notice}</Notice>}

      <div className={styles.step}>
        {step < 4 ? (
          <Step form={form} set={set} errors={errors} />
        ) : (
          <>
            <EventPreview form={form} organizerName={organizer?.name} />
            {missing.length > 0 ? (
              <div className={styles.todo}>
                <h2>Before you submit</h2>
                <ul>
                  {missing.map((m) => (
                    <li key={m.message}>
                      <span>{m.message}</span>
                      <Button variant="quiet" onClick={() => setStep(m.step)}>Fix</Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Notice tone="success">Everything is in place.</Notice>
            )}
            {submitError && (
              <Notice tone="error">
                {submitError.message}
                {Array.isArray(submitError.details) && submitError.details.length > 1 && (
                  <>{" "}({submitError.details.map((d) => d.message).join(" ")})</>
                )}
              </Notice>
            )}
          </>
        )}
      </div>

      <div className={styles.footer}>
        {step > 0 ? <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button> : <Button variant="quiet" href="/host/dashboard">Exit</Button>}
        {step < 4 ? (
          <Button onClick={next}>Next</Button>
        ) : autosave ? (
          <>
            <Button variant="secondary" onClick={async () => (await saveNow()) && router.push("/host/dashboard")} disabled={submitting}>Save draft</Button>
            <Button onClick={submit} loading={submitting} disabled={missing.length > 0}>{status === "rejected" ? "Resubmit for review" : "Submit for review"}</Button>
          </>
        ) : (
          <Button onClick={async () => (await saveNow()) && router.push(`/host/events/${idRef.current}`)} disabled={missing.length > 0}>Save changes</Button>
        )}
      </div>
    </div>
  );
}

function Loader({ eventId }) {
  const load = useCallback(() => (eventId ? api.getEvent(eventId) : Promise.resolve(null)), [eventId]);
  const state = useAsync(load);
  const locked = state.data && !["draft", "rejected", "in_review", "live"].includes(state.data.status);

  return (
    <AsyncView
      state={state}
      skeleton={<Skeleton lines={5} label="Loading your event" />}
      empty={locked && <EmptyState title="This event can't be edited" text={`It's ${state.data.status}. You can duplicate it from your dashboard to run it again.`} action={<Button href="/host/dashboard">Back to dashboard</Button>} />}
    >
      <Wizard initial={{ id: state.data?.id, event: state.data }} />
    </AsyncView>
  );
}

export default function EventWizard({ eventId }) {
  return (
    <RequireHost>
      <Loader eventId={eventId} />
    </RequireHost>
  );
}
