import { events as demoEvents } from "../../../data/events";
import { nearbyDistricts, nepalLocations } from "../../../data/nepalLocations";
import { getLocationCoordinates, getWeekEvents } from "../../../data/trending";

function normalize(value) {
  return value.trim().toLocaleLowerCase();
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

export function GET(request) {
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

  const provinceEvents = demoEvents.filter(
    (event) => normalize(event.province) === normalize(location.province),
  );
  const coordinates = getLocationCoordinates(location);
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
