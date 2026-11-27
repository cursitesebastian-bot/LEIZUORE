import {
  getRestaurantStats,
  restaurants,
} from "../../../data/restaurants";
import { nearbyDistricts, nepalLocations } from "../../../data/nepalLocations";
import {
  getLocationCoordinates,
  haversineKm,
} from "../../../data/trending";

function normalize(value) {
  return value.trim().toLocaleLowerCase();
}

function createScope(scope, scopeLabel, location, matches) {
  const coordinates = getLocationCoordinates(location);
  const reviewStore = globalThis.__leizoureRestaurantReviews ?? {};

  const sortedMatches = matches
    .map((restaurant) => {
      const stats = getRestaurantStats(
        restaurant,
        reviewStore[restaurant.id] ?? [],
      );
      return {
        ...restaurant,
        rating: stats.rating,
        reviews: stats.reviewCount,
        distanceKm:
          coordinates && restaurant.lat && restaurant.lng
            ? Math.round(haversineKm(coordinates, restaurant) * 10) / 10
            : null,
      };
    })
    .sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm || b.rating - a.rating;
    });

  return Response.json({
    restaurants: sortedMatches,
    scope,
    scopeLabel,
  });
}

export function GET(request) {
  const searchParams = new URL(request.url).searchParams;
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

  const provinceMatches = restaurants.filter(
    (restaurant) =>
      normalize(restaurant.province) === normalize(location.province),
  );
  const city = normalize(location.city);
  const district = normalize(location.district);

  const cityMatches = provinceMatches.filter(
    (restaurant) => normalize(restaurant.city) === city,
  );
  if (cityMatches.length) {
    return createScope("city", `Dining in ${location.city}`, location, cityMatches);
  }

  const districtMatches = provinceMatches.filter(
    (restaurant) => normalize(restaurant.district) === district,
  );
  if (districtMatches.length) {
    return createScope(
      "district",
      `Dining in ${location.district} district`,
      location,
      districtMatches,
    );
  }

  const nearby = (nearbyDistricts[location.district] ?? []).map(normalize);
  const nearbyMatches = provinceMatches.filter((restaurant) =>
    nearby.includes(normalize(restaurant.district)),
  );
  if (nearbyMatches.length) {
    return createScope(
      "nearby",
      `Restaurants near ${location.district}`,
      location,
      nearbyMatches,
    );
  }

  return createScope(
    "province",
    `Dining across ${location.province}`,
    location,
    provinceMatches,
  );
}

export async function POST(request) {
  let reservation;

  try {
    reservation = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid reservation details." },
      { status: 400 },
    );
  }

  const restaurant = restaurants.find(
    (item) => item.id === reservation.restaurantId,
  );
  const name = reservation.name?.trim();
  const phone = reservation.phone?.trim();
  const date = reservation.date?.trim();
  const time = reservation.time?.trim();
  const guests = Number(reservation.guests);

  if (
    !restaurant ||
    !name ||
    phone?.length < 7 ||
    !date ||
    !time ||
    !Number.isInteger(guests) ||
    guests < 1 ||
    guests > 20
  ) {
    return Response.json(
      { error: "Please complete a valid reservation form." },
      { status: 400 },
    );
  }

  const selectedDate = new Date(`${date}T${time}:00`);
  if (Number.isNaN(selectedDate.getTime()) || selectedDate.getTime() < Date.now()) {
    return Response.json(
      { error: "Choose a future date and time." },
      { status: 400 },
    );
  }

  const reservationStore = globalThis.__leizoureReservations ?? {};
  const reference = `LZ-${Date.now().toString().slice(-8)}`;
  reservationStore[reference] = {
    reference,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    completed: false,
  };
  globalThis.__leizoureReservations = reservationStore;

  return Response.json({
    confirmed: true,
    reference,
    restaurant: restaurant.name,
    date,
    time,
    guests,
  });
}
