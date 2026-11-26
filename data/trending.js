// Put this file at: lib/trending.js
// Plain helper functions. Later, the backend can do most of this
// (filter by distance and dates, ranking) and the component stays the same.

// Used only when no location is passed in. Coordinates are approximate.
export const DEFAULT_LOCATION = {
  name: "Mahalaxmi, Lalitpur",
  lat: 27.6396,
  lng: 85.3597,
};

export const RADIUS_KM = 30; // only show events within this distance
export const WEEK_DAYS = 7; // "this week" = the next 7 days from now
export const MAX_ITEMS = 5; // 1 featured + 4 in the list
// 0 = Sunday ... 6 = Saturday. Nepal's weekly holiday is Saturday,
// so Friday + Saturday. Change this if you want Saturday + Sunday.
export const WEEKEND_DAYS = [5, 6];

export const FILTERS = [
  { id: "week", label: "All week" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "Weekend" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const dayDiff = (a, b) =>
  Math.round((startOfDay(a) - startOfDay(b)) / DAY_MS);

const hasCoords = (p) =>
  p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

// Straight-line distance in km between two { lat, lng } points.
export function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Events in the next 7 days, near the user, most "trending" first.
// Trending = more people going + closer to the user.
export function getWeekEvents(events, location, now) {
  const end = new Date(now.getTime() + WEEK_DAYS * DAY_MS);

  return events
    .map((event) => {
      const start = new Date(event.startsAt);
      const distanceKm =
        hasCoords(location) && hasCoords(event)
          ? haversineKm(location, event)
          : null;
      const score = (event.going ?? 0) / (1 + (distanceKm ?? 0) / 10);
      return { ...event, start, distanceKm, score };
    })
    .filter(
      (event) =>
        event.start >= now &&
        event.start < end &&
        (event.distanceKm === null || event.distanceKm <= RADIUS_KM)
    )
    .sort((a, b) => b.score - a.score);
}

export function filterByDay(list, filter, now) {
  switch (filter) {
    case "today":
      return list.filter((e) => dayDiff(e.start, now) === 0);
    case "tomorrow":
      return list.filter((e) => dayDiff(e.start, now) === 1);
    case "weekend":
      return list.filter((e) => WEEKEND_DAYS.includes(e.start.getDay()));
    default:
      return list;
  }
}

export function formatWhen(start, now) {
  const diff = dayDiff(start, now);
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : date;
  return { day, time };
}

export function formatDistance(km) {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.max(1, Math.round((km * 1000) / 50) * 50)} m away`;
  return `${km.toFixed(1)} km away`;
}

// How big the event is, from how many people are going.
export function sizeInfo(going = 0) {
  const count =
    going >= 1000 ? `${(going / 1000).toFixed(1).replace(".0", "")}k` : `${going}`;
  let label = "Intimate";
  if (going >= 1000) label = "Huge";
  else if (going >= 300) label = "Large";
  else if (going >= 50) label = "Medium";
  return { label, text: `${count} going` };
}
