import {
  getDefaultMenu,
  getRestaurantStats,
  getSeededReviews,
  restaurants,
} from "../../../../data/restaurants";

export async function GET(request, { params }) {
  const { id } = await params;
  const restaurant = restaurants.find((item) => item.id === id);
  if (!restaurant) {
    return Response.json({ error: "Restaurant not found." }, { status: 404 });
  }

  const reviewStore = globalThis.__leizoureRestaurantReviews ?? {};
  const extraReviews = reviewStore[id] ?? [];
  const stats = getRestaurantStats(restaurant, extraReviews);

  return Response.json({
    restaurant: {
      ...restaurant,
      rating: stats.rating,
      reviews: stats.reviewCount,
      menu: getDefaultMenu(restaurant),
    },
    reviews: [
      ...(Array.isArray(restaurant.reviews) ? restaurant.reviews : getSeededReviews()),
      ...extraReviews,
    ],
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const restaurant = restaurants.find((item) => item.id === id);
  if (!restaurant) {
    return Response.json({ error: "Restaurant not found." }, { status: 404 });
  }

  let action;
  try {
    action = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (action.action === "complete") {
    const reservationStore = globalThis.__leizoureReservations ?? {};
    const reference = action.reference?.trim();
    const reservation = reference ? reservationStore[reference] : null;

    if (
      !reservation ||
      reservation.restaurantId !== id ||
      reservation.completed
    ) {
      return Response.json(
        { error: "This reservation reference is invalid or already completed." },
        { status: 400 },
      );
    }

    reservation.completed = true;
    reservation.reviewAvailable = true;
    globalThis.__leizoureReservations = reservationStore;
    return Response.json({
      confirmed: true,
      reviewAvailable: true,
      message: "Dining marked complete. The review link is now available.",
    });
  }

  if (action.action === "review") {
    const reservationStore = globalThis.__leizoureReservations ?? {};
    const reference = action.reference?.trim();
    const reservation = reference ? reservationStore[reference] : null;

    if (
      !reservation ||
      reservation.restaurantId !== id ||
      !reservation.completed
    ) {
      return Response.json(
        { error: "Only diners with a completed reservation can review." },
        { status: 403 },
      );
    }

    const rating = Number(action.rating);
    const description = action.description?.trim();
    const name = action.name?.trim() || "Verified diner";
    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !description ||
      description.length < 10
    ) {
      return Response.json(
        { error: "Add a rating and a description of at least 10 characters." },
        { status: 400 },
      );
    }

    if (reservation.reviewSubmitted) {
      return Response.json(
        { error: "A review has already been submitted for this visit." },
        { status: 400 },
      );
    }

    const reviewStore = globalThis.__leizoureRestaurantReviews ?? {};
    reviewStore[id] = [
      ...(reviewStore[id] ?? []),
      { name, rating, description, verified: true },
    ];
    globalThis.__leizoureRestaurantReviews = reviewStore;
    reservation.reviewSubmitted = true;
    globalThis.__leizoureReservations = reservationStore;

    const stats = getRestaurantStats(
      restaurant,
      reviewStore[id],
    );
    return Response.json({
      confirmed: true,
      rating: stats.rating,
      reviewCount: stats.reviewCount,
    });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
