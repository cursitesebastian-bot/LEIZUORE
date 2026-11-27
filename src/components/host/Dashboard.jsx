"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/host/api";
import { useAsync } from "@/lib/host/useAsync";
import { formatNpr, formatWhen, STATUS_LABELS } from "@/lib/host/format";
import { AsyncView, Button, EmptyState, Notice, PageHeader, Segmented, Skeleton, StatusChip } from "./ui";
import { RequireHost, useHostAuth } from "./HostAuth";
import styles from "./Dashboard.module.css";

const FILTERS = [{ value: "", label: "All" }, ...["draft", "in_review", "live", "ended", "rejected"].map((s) => ({ value: s, label: STATUS_LABELS[s] }))];
const CAN_EDIT = ["draft", "rejected", "in_review", "live"];

function Stats() {
  const load = useCallback(() => api.dashboard(), []);
  const state = useAsync(load);
  const d = state.data;
  return (
    <AsyncView state={state} skeleton={<Skeleton lines={2} label="Loading your numbers" />}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <p>Upcoming events</p>
          <strong>{d?.upcoming_events}</strong>
        </div>
        <div className={styles.stat}>
          <p>Tickets sold</p>
          <strong>{d?.tickets_sold}</strong>
        </div>
        <div className={styles.stat}>
          <p>Revenue</p>
          <strong className={styles.accent}>{formatNpr(d?.revenue_npr)}</strong>
          <span>{formatNpr(d?.net_revenue_npr)} after the ZOURE fee</span>
        </div>
      </div>
      {d?.next_event && (
        <Link className={styles.next} href={`/host/events/${d.next_event.id}`}>
          <span>Next event</span>
          <strong>{d.next_event.title}</strong>
          <span>{formatWhen(d.next_event.starts_at)} · {d.next_event.tickets_sold} booked</span>
        </Link>
      )}
      {d && d.verification_status !== "verified" && (
        <Notice>
          {d.verification_status === "pending"
            ? "Your verification is being checked. Paid tickets unlock once it's approved."
            : "Free events work right away. Paid tickets need a verified account."}
        </Notice>
      )}
    </AsyncView>
  );
}

function EventRow({ event, onChanged, onMessage }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action, success) {
    setBusy(true);
    try {
      const result = await action();
      onMessage({ tone: "success", text: success });
      return result;
    } catch (err) {
      onMessage({ tone: "error", text: err.message });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  async function duplicate() {
    const copy = await run(() => api.duplicateEvent(event.id), "Copied as a new draft.");
    if (copy) router.push(`/host/events/${copy.id}/edit`);
  }

  async function cancel() {
    if (await run(() => api.cancelEvent(event.id), "Event cancelled. Attendees will be told.")) onChanged();
  }

  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <Link href={`/host/events/${event.id}`} className={styles.title}>{event.title}</Link>
        <p>{formatWhen(event.starts_at)}{event.venue_name ? ` · ${event.venue_name}` : ""}</p>
        {event.status === "rejected" && event.rejection_reason && <p className={styles.reason}>Why: {event.rejection_reason}</p>}
      </div>
      <div className={styles.rowMeta}>
        <StatusChip status={event.status} />
        <span>{event.tickets_sold} sold</span>
      </div>
      <div className={styles.actions}>
        {confirming ? (
          <>
            <span className={styles.confirm}>Cancel this event? Paid tickets are refunded.</span>
            <Button variant="danger" loading={busy} onClick={cancel}>Yes, cancel</Button>
            <Button variant="quiet" onClick={() => setConfirming(false)}>Keep</Button>
          </>
        ) : (
          <>
            {CAN_EDIT.includes(event.status) && <Button variant="quiet" href={`/host/events/${event.id}/edit`}>Edit</Button>}
            <Button variant="quiet" onClick={duplicate} disabled={busy}>Duplicate</Button>
            {["live", "in_review"].includes(event.status) && <Button variant="quiet" onClick={() => setConfirming(true)}>Cancel</Button>}
          </>
        )}
      </div>
    </li>
  );
}

function Events() {
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState(null);
  const load = useCallback(() => api.listEvents(status), [status]);
  const state = useAsync(load);
  const items = state.data?.items ?? [];

  return (
    <section aria-labelledby="events-title" className={styles.events}>
      <h2 id="events-title">Your events</h2>
      <Segmented label="Show" options={FILTERS} value={status} onChange={setStatus} />
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <AsyncView
        state={state}
        empty={
          !state.loading && !items.length && (
            <EmptyState
              title={status ? "Nothing here" : "No events yet"}
              text={status ? "No events match this filter." : "Create your first event. It only takes a few minutes and you can save it as a draft."}
              action={!status && <Button href="/host/events/new">Create event</Button>}
            />
          )
        }
      >
        <ul className={styles.list}>
          {items.map((e) => (
            <EventRow key={e.id} event={e} onChanged={state.reload} onMessage={setMessage} />
          ))}
        </ul>
      </AsyncView>
    </section>
  );
}

function Screen() {
  const { signOut } = useHostAuth();
  return (
    <>
      <PageHeader
        title="Dashboard"
        text="Everything here comes from real bookings."
        actions={
          <>
            <Button variant="quiet" onClick={signOut}>Sign out</Button>
            <Button href="/host/events/new">Create event</Button>
          </>
        }
      />
      <Stats />
      <Events />
    </>
  );
}

export default function Dashboard() {
  return (
    <RequireHost>
      <Screen />
    </RequireHost>
  );
}
