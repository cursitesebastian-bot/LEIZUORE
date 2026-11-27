import { events as demoEvents } from "../../../data/events";
import { nearbyDistricts, nepalLocations } from "../../../data/nepalLocations";
import { getLocationCoordinates, getWeekEvents } from "../../../data/trending";

function normalize(value) {
  return value.trim().toLocaleLowerCase();
}

const API_URL =
  process.env.ZOURE_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000/api/v1";

// Real events from the ZOURE API for the next 7 days. Returns null when the API
// is down or has nothing nearby, so the caller can fall back to the demo data.
async function fetchLiveEvents(coordinates, radiusKm) {
  if (!coordinates) return null;
  const now = new Date();
  const query = new URLSearchParams({
    lat: String(coordinates.lat),
    lng: String(coordinates.lng),
    radius_km: String(radiusKm),
    from: now.toISOString(),
    to: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    limit: "20",
  });
  try {
    const res = await fetch(`${API_URL}/events?${query}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const { items } = await res.json();
    if (!items?.length) return null;
    return items.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
      venue: event.venue_name ?? (event.is_online ? "Online" : ""),
      image: event.cover_image_url ?? null,
      href: `/events/${event.slug}`,
      going: event.going,
      distanceKm: event.distance_km === null ? null : Math.round(event.distance_km * 10) / 10,
    }));
  } catch {
    return null;
  }
}

function createScope(scope, scopeLabel, events, location) {
  const coordinates = getLocationCoordinates(location);
  const sortedEvents = getWeekEvents(
    events,
    coordinates,
    new Date(),
  ).map(({ start, score, ...event }) => ({
    ...event,
    distanceKm:
      event.distanceKm === null
        ? null
        : Math.round(event.distanceKm * 10) / 10,
  }));

  return Response.json({
    events: sortedEvents,
    scope,
    scopeLabel,
    distanceFrom: coordinates ? `${location.city}, ${location.district}` : null,
  });
}

export async function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const radiusKm = Math.min(
    Math.max(Number(searchParams.get("radius")) || 30, 1),
    100,
  );
  const location = {
    province: searchParams.get("province")?.trim() ?? "",
    district: searchParams.get("district")?.trim() ?? "",
    city: searchParams.get("city")?.trim() ?? "",
  };

  if (
    !location.province ||
    !location.district ||
    !location.city ||
    !nepalLocations[location.province] ||
    !nepalLocations[location.province].includes(location.district)
  ) {
    return Response.json(
      { error: "Select a valid Nepal province, district, and city." },
      { status: 400 },
    );
  }

  const coordinates = getLocationCoordinates(location);
  const liveEvents = await fetchLiveEvents(coordinates, radiusKm);
  if (liveEvents) {
    // The API already sorts by trending score and filters by radius.
    return Response.json({
      events: liveEvents,
      scope: "nearby",
      scopeLabel: `Within ${radiusKm} km`,
      distanceFrom: `${location.city}, ${location.district}`,
    });
  }

  const provinceEvents = demoEvents.filter(
    (event) => normalize(event.province) === normalize(location.province),
  );
  const upcomingProvinceEvents = getWeekEvents(
    provinceEvents,
    coordinates,
    new Date(),
    radiusKm,
  );
  const city = normalize(location.city);
  const district = normalize(location.district);
  const cityEvents = upcomingProvinceEvents.filter(
    (event) => normalize(event.city) === city,
  );

  if (cityEvents.length) {
    return createScope("city", `In ${location.city}`, cityEvents, location);
  }

  const districtEvents = upcomingProvinceEvents.filter(
    (event) => normalize(event.district) === district,
  );

  if (districtEvents.length) {
    return createScope(
      "district",
      `In ${location.district} district`,
      districtEvents,
      location,
    );
  }

  const nearby = (nearbyDistricts[location.district] ?? []).map(normalize);
  const nearbyEvents = upcomingProvinceEvents.filter((event) =>
    nearby.includes(normalize(event.district)),
  );

  if (nearbyEvents.length) {
    return createScope(
      "nearby",
      `Near ${location.district}`,
      nearbyEvents,
      location,
    );
  }

  return createScope(
    "province",
    `Across ${location.province}`,
    provinceEvents,
    location,
  );
}
