import { notFound } from "next/navigation";
import { restaurants } from "../../../data/restaurants";
import RestaurantDetail from "../../../components/RestaurantDetail";

export function generateStaticParams() {
  return restaurants.map((restaurant) => ({ id: restaurant.id }));
}

export default async function RestaurantPage({ params }) {
  const { id } = await params;
  const restaurant = restaurants.find((item) => item.id === id);
  if (!restaurant) {
    notFound();
  }

  return <RestaurantDetail restaurantId={restaurant.id} />;
}
