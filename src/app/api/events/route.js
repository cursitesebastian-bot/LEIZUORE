import { mockEvents } from "../../../data/mockEvents";
import { nearbyDistricts, nepalLocations } from "../../../data/nepalLocations";

function normalize(value) {
  return value.trim().toLocaleLowerCase();
}

function createResponse(events, scope, scopeLabel) {
  return Response.json({ events, scope, scopeLabel });
}

export function GET(request) {
  const searchParams = new URL(request.url).searchParams;
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
