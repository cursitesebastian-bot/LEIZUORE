import { mockEvents } from "../../../data/mockEvents";
import { nearbyDistricts, nepalLocations } from "../../../data/nepalLocations";
import { haversineKm } from "../../../data/trending";

function normalize(value) {
  return value.trim().toLocaleLowerCase();
}

function createResponse(events, scope, scopeLabel) {
  return Response.json({ events, scope, scopeLabel });
}

export function GET(request) {
  const searchParams = new URL(request.url).searchParams;
  const latValue = searchParams.get("lat");
  const lngValue = searchParams.get("lng");
  const lat = latValue === null ? Number.NaN : Number(latValue);
  const lng = lngValue === null ? Number.NaN : Number(lngValue);
  const radius = Math.min(
    Math.max(Number(searchParams.get("radius")) || 30, 1),
    100,
  );
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const now = searchParams.get("from") ? new Date(searchParams.get("from")) : new Date();
  const end = searchParams.get("to")
    ? new Date(searchParams.get("to"))
    : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (!Number.isFinite(now.getTime()) || !Number.isFinite(end.getTime())) {
    return Response.json(
      { error: "Invalid from or to date." },
      { status: 400 },
    );
  }

  if (hasCoordinates) {
    const events = mockEvents
      .map((event) => {
        const distanceKm =
          Number.isFinite(event.lat) && Number.isFinite(event.lng)
            ? haversineKm({ lat, lng }, { lat: event.lat, lng: event.lng })
            : null;
        return { ...event, distanceKm };
      })
      .filter((event) => {
        const start = new Date(event.startsAt);
        return start >= now && start <= end;
      })
      .filter((event) =>
        event.distanceKm === null || event.distanceKm <= radius,
      )
      .sort((a, b) => {
        const scoreA = (a.going ?? 0) / (1 + (a.distanceKm ?? 0) / 10);
        const scoreB = (b.going ?? 0) / (1 + (b.distanceKm ?? 0) / 10);
        return scoreB - scoreA;
      })
      .map((event) => ({
        id: event.id,
        title: event.title,
        category: event.kind,
        image: event.posterUrl,
        venue: event.venue,
        startsAt: event.startsAt,
        lat: event.lat ?? null,
        lng: event.lng ?? null,
        going: event.going ?? 0,
        href: `/Events/${event.id}`,
        distanceKm:
          event.distanceKm === null
            ? null
            : Math.round(event.distanceKm * 10) / 10,
      }));

    return Response.json({
      events,
      radiusKm: radius,
      from: now.toISOString(),
      to: end.toISOString(),
    });
  }

  const province = searchParams.get("province")?.trim() ?? "";
  const district = searchParams.get("district")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";

  if (
    !province ||
    !district ||
    !city ||
    !nepalLocations[province] ||
    !nepalLocations[province].includes(district)
  ) {
    return Response.json(
      { error: "Select a valid Nepal province, district, and city." },
      { status: 400 },
    );
  }

  const provinceEvents = mockEvents.filter(
    (event) => normalize(event.province) === normalize(province),
  );
  const cityEvents = provinceEvents.filter(
    (event) => normalize(event.city) === normalize(city),
  );

  if (cityEvents.length) {
    return createResponse(cityEvents, "city", `In ${city}`);
  }

  const districtEvents = provinceEvents.filter(
    (event) => normalize(event.district) === normalize(district),
  );

  if (districtEvents.length) {
    return createResponse(districtEvents, "district", `In ${district} district`);
  }

  const nearby = nearbyDistricts[district] ?? [];
  const nearbyEvents = provinceEvents.filter((event) =>
    nearby.some((nearbyDistrict) => normalize(event.district) === normalize(nearbyDistrict)),
  );

  if (nearbyEvents.length) {
    return createResponse(nearbyEvents, "nearby", `Nearby ${district}`);
  }

  return createResponse(provinceEvents, "province", `Across ${province}`);
}
