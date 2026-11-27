"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/host/api";
import { useAsync } from "@/lib/host/useAsync";
import { formatNpr, formatWhen } from "@/lib/host/format";
import { AsyncView, Button, EmptyState, ErrorState, Field, Notice, PageHeader, Segmented, Skeleton, StatusChip } from "./ui";
import { RequireHost } from "./HostAuth";
import styles from "./EventDetail.module.css";

const FILTERS = [
  { value: "all", label: "Everyone" },
  { value: "in", label: "Checked in" },
  { value: "out", label: "Not yet" },
];

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Bookings({ eventId }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);
  const q = useDebounced(search.trim());
  const load = useCallback(() => api.listBookings(eventId, { q, limit: 200 }), [eventId, q]);
  const state = useAsync(load);

  const rows = (state.data?.items ?? []).filter((b) => filter === "all" || (filter === "in") === !!b.checked_in_at);
  const nothingYet = !state.loading && !state.data?.items.length && !q;

  async function exportCsv() {
    setExporting(true);
    setMessage(null);
    try {
      const url = URL.createObjectURL(await api.bookingsCsv(eventId));
      const a = Object.assign(document.createElement("a"), { href: url, download: `zoure-bookings-${eventId}.csv` });
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ tone: "success", text: "Your CSV is downloading." });
    } catch (err) {
      setMessage({ tone: "error", text: err.message });
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className={styles.bookings} aria-labelledby="bookings-title">
      <div className={styles.bookingsHead}>
        <h2 id="bookings-title">Bookings</h2>
        <Button variant="secondary" loading={exporting} onClick={exportCsv} disabled={nothingYet}>Export CSV</Button>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {!nothingYet && (
        <div className={styles.controls}>
          <Field label="Search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or phone" />
          <Segmented label="Show" options={FILTERS} value={filter} onChange={setFilter} />
        </div>
      )}
      <AsyncView
        state={state}
        skeleton={<Skeleton lines={5} label="Loading bookings" />}
        empty={
          nothingYet ? (
            <EmptyState title="No bookings yet" text="When people book, they'll appear here with their ticket and check-in status." />
          ) : (
            !state.loading && !rows.length && <EmptyState title="No matches" text="Try a different name or filter." />
          )
        }
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Ticket</th>
                <th>Qty</th>
                <th>Paid</th>
                <th>Checked in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td data-label="Name">
                    <strong>{b.attendee_name || "Guest"}</strong>
                    {b.attendee_phone && <span>{b.attendee_phone}</span>}
                  </td>
                  <td data-label="Ticket">{b.ticket_name}</td>
                  <td data-label="Qty">{b.quantity}</td>
                  <td data-label="Paid">{b.total_npr ? formatNpr(b.total_npr) : "Free"}</td>
                  <td data-label="Checked in">{b.checked_in_at ? formatWhen(b.checked_in_at) : "Not yet"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncView>
    </section>
  );
}

function Screen({ eventId }) {
  const load = useCallback(() => api.getEvent(eventId), [eventId]);
  const state = useAsync(load);
  const e = state.data;
  const capacity = e?.ticket_types.reduce((sum, t) => sum + t.capacity, 0) ?? 0;
  const pct = capacity ? Math.min(100, Math.round((e.tickets_sold / capacity) * 100)) : 0;

  if (state.loading && !e) return <Skeleton lines={4} label="Loading event" />;
  if (state.error && !e) {
    return state.error.status === 404 ? <EmptyState title="Event not found" text="It may have been removed, or it belongs to another account." action={<Button href="/host/dashboard">Back to dashboard</Button>} /> : <ErrorState error={state.error} onRetry={state.reload} />;
  }

  return (
    <>
      <PageHeader
        title={e.title}
        text={`${formatWhen(e.starts_at)}${e.venue_name ? ` · ${e.venue_name}` : ""}`}
        actions={
          <>
            {["draft", "rejected", "in_review", "live"].includes(e.status) && <Button variant="secondary" href={`/host/events/${e.id}/edit`}>Edit</Button>}
            {e.status === "live" && <Button href={`/host/events/${e.id}/check-in`}>Check-in</Button>}
          </>
        }
      />
      <div className={styles.summary}>
        <StatusChip status={e.status} />
        {e.status === "rejected" && e.rejection_reason && <Notice tone="error">Rejected: {e.rejection_reason}</Notice>}
        <div className={styles.cards}>
          <div>
            <p>Booked</p>
            <strong>{e.tickets_sold} <small>of {capacity}</small></strong>
            <div className={styles.bar} role="img" aria-label={`${pct}% of tickets booked`}><span style={{ width: `${pct}%` }} /></div>
          </div>
          <div>
            <p>Revenue</p>
            <strong>{formatNpr(e.revenue_npr)}</strong>
          </div>
        </div>
      </div>
      <Bookings eventId={eventId} />
    </>
  );
}

export default function EventDetail({ eventId }) {
  return (
    <RequireHost>
      <Screen eventId={eventId} />
    </RequireHost>
  );
}
