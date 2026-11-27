// Pure helpers for the create-event form: state shape, API payload, validation and the review checklist.
import { inputToIso, isoToInput } from "@/lib/host/format";

export const STEPS = ["Basics", "When", "Where", "Tickets", "Review"];
export const MAX_TICKET_TYPES = 10;
export const MIN_PAID_PRICE = 10; // Khalti's minimum payment is Rs 10

let keySeed = 0;
export const newKey = () => `t${++keySeed}`;

export const blankTicket = () => ({ key: newKey(), name: "General", price: "", capacity: "50", max_per_user: "4", sales_start: "", sales_end: "", sold: 0 });

export const emptyForm = () => ({
  title: "", category: "", description: "", cover_image_url: null, gallery_urls: [],
  starts_at: "", ends_at: "", repeat: false, recurrence_rule: "", registration_deadline: "",
  is_online: false, venue_name: "", address: "", lat: "", lng: "",
  paid: false, tickets: [blankTicket()],
});

export function fromEvent(e) {
  const tickets = e.ticket_types.length
    ? e.ticket_types.map((t) => ({
        key: newKey(), id: t.id, name: t.name, price: String(t.price_npr || ""), capacity: String(t.capacity), max_per_user: String(t.max_per_user),
        sales_start: isoToInput(t.sales_start), sales_end: isoToInput(t.sales_end), sold: t.sold ?? 0,
      }))
    : [blankTicket()];
  return {
    title: e.title ?? "", category: e.category ?? "", description: e.description ?? "",
    cover_image_url: e.cover_image_url, gallery_urls: e.gallery_urls ?? [],
    starts_at: isoToInput(e.starts_at), ends_at: isoToInput(e.ends_at),
    repeat: !!e.recurrence_rule, recurrence_rule: e.recurrence_rule ?? "",
    registration_deadline: isoToInput(e.registration_deadline),
    is_online: e.is_online, venue_name: e.venue_name ?? "", address: e.address ?? "",
    lat: e.lat ?? "", lng: e.lng ?? "",
    paid: e.ticket_types.some((t) => t.price_npr > 0), tickets,
  };
}

const num = (v) => (v === "" || v === null || Number.isNaN(Number(v)) ? null : Number(v));
const ticketIsValid = (t) => t.name.trim() && num(t.capacity) > 0 && num(t.max_per_user) > 0;

/** Body for POST/PATCH /events. Incomplete tickets are left out so autosave never wipes saved ones. */
export function toPayload(f) {
  const payload = {
    title: f.title.trim(),
    category: f.category,
    description: f.description.trim() || null,
    cover_image_url: f.cover_image_url,
    gallery_urls: f.gallery_urls,
    starts_at: inputToIso(f.starts_at),
    ends_at: inputToIso(f.ends_at),
    registration_deadline: inputToIso(f.registration_deadline),
    recurrence_rule: f.repeat ? f.recurrence_rule || "FREQ=WEEKLY" : null,
    is_online: f.is_online,
    venue_name: f.is_online ? null : f.venue_name.trim() || null,
    address: f.is_online ? null : f.address.trim() || null,
    lat: f.is_online ? null : num(f.lat),
    lng: f.is_online ? null : num(f.lng),
  };
  if (f.tickets.every(ticketIsValid)) {
    payload.ticket_types = f.tickets.map((t) => ({
      ...(t.id ? { id: t.id } : {}),
      name: t.name.trim(),
      price_npr: f.paid ? Math.round(num(t.price) ?? 0) : 0,
      capacity: Math.round(num(t.capacity)),
      max_per_user: Math.round(num(t.max_per_user)),
      sales_start: inputToIso(t.sales_start),
      sales_end: inputToIso(t.sales_end),
    }));
  }
  return payload;
}

/** Plain-language errors for the step the host is leaving. Keys match field names. */
export function validateStep(step, f) {
  const e = {};
  if (step === 0) {
    if (f.title.trim().length < 3) e.title = "Give your event a name (at least 3 characters).";
    if (!f.category) e.category = "Choose a category so people can find it.";
  }
  if (step === 1) {
    if (f.starts_at && f.ends_at && f.ends_at <= f.starts_at) e.ends_at = "The event must end after it starts.";
    if (f.starts_at && f.registration_deadline && f.registration_deadline > f.starts_at) e.registration_deadline = "Registration must close before the event starts.";
  }
  if (step === 2 && f.lat !== "" && (num(f.lat) === null || Math.abs(num(f.lat)) > 90)) e.lat = "Latitude must be between -90 and 90.";
  if (step === 2 && f.lng !== "" && (num(f.lng) === null || Math.abs(num(f.lng)) > 180)) e.lng = "Longitude must be between -180 and 180.";
  if (step === 3) {
    f.tickets.forEach((t, i) => {
      const te = {};
      if (!t.name.trim()) te.name = "Name this ticket, e.g. General.";
      if (!(num(t.capacity) > 0)) te.capacity = "Enter how many tickets are available.";
      if (f.paid && !(num(t.price) >= MIN_PAID_PRICE)) te.price = `Paid tickets start at Rs ${MIN_PAID_PRICE}.`;
      if (t.sales_start && t.sales_end && t.sales_end <= t.sales_start) te.sales_end = "Sales must end after they start.";
      if (Object.keys(te).length) e[`ticket${i}`] = te;
    });
  }
  return e;
}

/** What is still missing before "Submit for review". Mirrors the server's completeness rules. */
export function checklist(f, verified) {
  const missing = [];
  const need = (ok, step, message) => ok || missing.push({ step, message });
  need(f.description.trim().length >= 20, 0, "Describe the event in at least 20 characters.");
  need(!!f.cover_image_url, 0, "Add a cover image.");
  need(!!f.starts_at && !!f.ends_at, 1, "Choose when it starts and ends.");
  if (!f.is_online) {
    need(!!f.venue_name.trim(), 2, "Add the venue name.");
    need(!!f.address.trim(), 2, "Add the address.");
    need(num(f.lat) !== null && num(f.lng) !== null, 2, "Add a map location so people can find you.");
  }
  need(f.tickets.length > 0 && f.tickets.every(ticketIsValid), 3, "Add at least one ticket type (free is fine).");
  if (f.paid) need(verified, 3, "Paid tickets need a verified account. Switch to free tickets or verify your account.");
  return missing;
}

export const minPrice = (f) => (f.paid ? Math.min(...f.tickets.map((t) => num(t.price) ?? 0)) : 0);
