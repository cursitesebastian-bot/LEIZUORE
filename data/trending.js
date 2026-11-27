export const WEEK_DAYS = 7; // "this week" = the next 7 days from now
export const MAX_ITEMS = 5; // 1 featured + 4 in the list
// 0 = Sunday ... 6 = Saturday. Nepal's weekly holiday is Saturday,
// so Friday + Saturday. Change this if you want Saturday + Sunday.
export const WEEKEND_DAYS = [5, 6];

const locationCoordinates = {
  "bharatpur, chitwan": { lat: 27.6833, lng: 84.4333 },
  "bharatpur, chitwan district": { lat: 27.6833, lng: 84.4333 },
  "chitwan, chitwan district": { lat: 27.6833, lng: 84.4333 },
  "bhaktapur, bhaktapur": { lat: 27.671, lng: 85.4298 },
  "bhaktapur, bhaktapur district": { lat: 27.671, lng: 85.4298 },
  "morang, morang district": { lat: 26.4525, lng: 87.2718 },
  "biratnagar, morang": { lat: 26.4525, lng: 87.2718 },
  "biratnagar, morang district": { lat: 26.4525, lng: 87.2718 },
  "surkhet, surkhet district": { lat: 28.6, lng: 81.6333 },
  "birendranagar, surkhet": { lat: 28.6, lng: 81.6333 },
  "birendranagar, surkhet district": { lat: 28.6, lng: 81.6333 },
  "rupandehi, rupandehi district": { lat: 27.7006, lng: 83.4484 },
  "butwal, rupandehi": { lat: 27.7006, lng: 83.4484 },
  "butwal, rupandehi district": { lat: 27.7006, lng: 83.4484 },
  "kailali, kailali district": { lat: 28.695, lng: 80.593 },
  "dhangadhi, kailali": { lat: 28.695, lng: 80.593 },
  "dhangadhi, kailali district": { lat: 28.695, lng: 80.593 },
  "makwanpur, makwanpur district": { lat: 27.4287, lng: 85.0322 },
  "hetauda, makwanpur": { lat: 27.4287, lng: 85.0322 },
  "hetauda, makwanpur district": { lat: 27.4287, lng: 85.0322 },
  "dhanusha, dhanusha district": { lat: 26.7288, lng: 85.9263 },
  "janakpur, dhanusha": { lat: 26.7288, lng: 85.9263 },
  "janakpur, dhanusha district": { lat: 26.7288, lng: 85.9263 },
  "kathmandu, kathmandu district": { lat: 27.7172, lng: 85.324 },
  "kathmandu, kathmandu": { lat: 27.7172, lng: 85.324 },
  "banke, banke district": { lat: 28.05, lng: 81.6167 },
  "lalitpur, lalitpur": { lat: 27.6588, lng: 85.3247 },
  "lalitpur, lalitpur district": { lat: 27.6588, lng: 85.3247 },
  "kaski, kaski district": { lat: 28.2096, lng: 83.9856 },
  "mahalaxmi, lalitpur": { lat: 27.6396, lng: 85.3597 },
  "mahalaxmi, lalitpur district": { lat: 27.6396, lng: 85.3597 },
  "nepalgunj, banke": { lat: 28.05, lng: 81.6167 },
  "nepalgunj, banke district": { lat: 28.05, lng: 81.6167 },
  "pokhara, kaski": { lat: 28.2096, lng: 83.9856 },
  "pokhara, kaski district": { lat: 28.2096, lng: 83.9856 },
  "thamel, kathmandu": { lat: 27.7154, lng: 85.3123 },
  "thamel, kathmandu district": { lat: 27.7154, lng: 85.3123 },
};

function normalizeLocation(value) {
  return value.trim().toLocaleLowerCase();
}

export function getLocationCoordinates(location) {
  const city = normalizeLocation(location.city);
  const district = normalizeLocation(location.district);

  return (
    locationCoordinates[`${city}, ${district}`] ??
    locationCoordinates[`${district}, ${district} district`] ??
    null
  );
}

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
export function getWeekEvents(events, location, now, radiusKm = 30) {
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
    .filter((event) => event.start >= now && event.start < end)
    .filter((event) => {
      if (!hasCoords(location) || event.distanceKm === null) return true;
      return event.distanceKm <= radiusKm;
    })
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
