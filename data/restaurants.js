const commonMenu = [
  { category: "Chef's picks", name: "House tasting plate", description: "Seasonal ingredients and house sauces", price: "NRs 1,250" },
  { category: "Main dishes", name: "Chef's signature main", description: "Prepared fresh for the table", price: "NRs 950" },
  { category: "Drinks", name: "Fresh fruit cooler", description: "Freshly prepared and chilled", price: "NRs 350" },
];

const seededReviews = [
  { name: "Aarav", rating: 5, description: "Excellent food, friendly service, and a comfortable atmosphere." },
  { name: "Samira", rating: 4, description: "Good portions and a memorable dining experience." },
  { name: "Rohan", rating: 5, description: "The staff were attentive and every dish was freshly prepared." },
];

export const restaurants = [
  {
    id: "le-patio-patan",
    name: "Le Patio",
    cuisine: "Continental",
    venue: "Pulchowk, Lalitpur",
    city: "Lalitpur",
    district: "Lalitpur",
    province: "Bagmati",
    lat: 27.6781,
    lng: 85.3174,
    rating: 4.8,
    reviews: 326,
    reviewCount: 326,
    price: "NRs 2,000",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=85",
    ],
    menuImages: [
      "https://images.unsplash.com/photo-1550966841-3cfb1d4c7d63?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85",
    ],
    menu: [
      { category: "Starters", name: "Roasted tomato bruschetta", description: "Tomato, basil, parmesan, sourdough", price: "NRs 650" },
      { category: "Starters", name: "Garden seasonal salad", description: "Greens, herbs, citrus dressing", price: "NRs 550" },
      { category: "Main dishes", name: "Creamy mushroom risotto", description: "Local mushrooms, parmesan, herbs", price: "NRs 1,150" },
      { category: "Main dishes", name: "Grilled chicken", description: "Potato gratin, vegetables, jus", price: "NRs 1,850" },
      { category: "Desserts", name: "Chocolate pot", description: "Dark chocolate, cream, berries", price: "NRs 520" },
      { category: "Drinks", name: "Mint lime cooler", description: "Fresh lime, mint, sparkling water", price: "NRs 350" },
    ],
    reviews: seededReviews,
    ratingBreakdown: { ambience: 4.8, food: 4.9, service: 4.7 },
    about: "A relaxed neighborhood restaurant in Patan serving seasonal continental dishes.",
    facilities: ["Air conditioning", "Wheelchair access", "Outdoor seating", "Free Wi-Fi"],
    phone: "+977 9800001001",
    hours: "10:00 AM - 10:00 PM",
  },
  {
    id: "bamboo-house-patan",
    name: "Bamboo House",
    cuisine: "Nepali",
    venue: "Patan Durbar Square",
    city: "Lalitpur",
    district: "Lalitpur",
    province: "Bagmati",
    lat: 27.6727,
    lng: 85.3253,
    rating: 4.7,
    reviews: 284,
    price: "NRs 1,400",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85",
    ],
    menuImages: [
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=85",
    ],
    menu: commonMenu,
    ratingBreakdown: { ambience: 4.6, food: 4.8, service: 4.6 },
    about: "Traditional Nepalese flavours served in a warm Patan courtyard setting.",
    facilities: ["Outdoor seating", "Family dining", "Free Wi-Fi"],
    phone: "+977 9800001002",
    hours: "11:00 AM - 9:30 PM",
  },
  {
    id: "the-nepalese-table",
    name: "The Nepalese Table",
    cuisine: "Newari",
    venue: "Jawalakhel, Lalitpur",
    city: "Lalitpur",
    district: "Lalitpur",
    province: "Bagmati",
    lat: 27.6704,
    lng: 85.3136,
    rating: 4.6,
    reviews: 198,
    price: "NRs 1,800",
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "garden-cafe-bhaktapur",
    name: "Garden Cafe",
    cuisine: "Cafe",
    venue: "Durbar Square, Bhaktapur",
    city: "Bhaktapur",
    district: "Bhaktapur",
    province: "Bagmati",
    lat: 27.671,
    lng: 85.4298,
    rating: 4.5,
    reviews: 156,
    price: "NRs 900",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "thamel-kitchen",
    name: "Thamel Kitchen",
    cuisine: "Multi-cuisine",
    venue: "Thamel, Kathmandu",
    city: "Kathmandu",
    district: "Kathmandu",
    province: "Bagmati",
    lat: 27.7154,
    lng: 85.3123,
    rating: 4.4,
    reviews: 412,
    price: "NRs 1,600",
    image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "pokhara-lakeside-grill",
    name: "Lakeside Grill",
    cuisine: "Grill",
    venue: "Lakeside, Pokhara",
    city: "Pokhara",
    district: "Kaski",
    province: "Gandaki",
    lat: 28.2096,
    lng: 83.9856,
    rating: 4.6,
    reviews: 238,
    price: "NRs 2,100",
    image: "https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "bharatpur-river-kitchen",
    name: "River Kitchen",
    cuisine: "Thakali",
    venue: "Narayani Riverfront",
    city: "Bharatpur",
    district: "Chitwan",
    province: "Bagmati",
    lat: 27.6833,
    lng: 84.4333,
    rating: 4.5,
    reviews: 171,
    price: "NRs 1,200",
    image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "biratnagar-dynasty",
    name: "Dynasty Biratnagar",
    cuisine: "Chinese",
    venue: "Traffic Chowk",
    city: "Biratnagar",
    district: "Morang",
    province: "Koshi",
    lat: 26.4525,
    lng: 87.2718,
    rating: 4.3,
    reviews: 143,
    price: "NRs 1,500",
    image: "https://images.unsplash.com/photo-1550966841-3cfb1d4c7d63?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "janakpur-sweet-kitchen",
    name: "Janaki Sweet Kitchen",
    cuisine: "Mithila",
    venue: "Janaki Mandir Road",
    city: "Janakpur",
    district: "Dhanusha",
    province: "Madhesh",
    lat: 26.7288,
    lng: 85.9263,
    rating: 4.4,
    reviews: 129,
    price: "NRs 1,000",
    image: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "butwal-view-dining",
    name: "View Dining",
    cuisine: "Multi-cuisine",
    venue: "Traffic Chowk, Butwal",
    city: "Butwal",
    district: "Rupandehi",
    province: "Lumbini",
    lat: 27.7006,
    lng: 83.4484,
    rating: 4.2,
    reviews: 118,
    price: "NRs 1,300",
    image: "https://images.unsplash.com/photo-1508424757105-b6d5ad9329d0?auto=format&fit=crop&w=900&q=85",
  },
];

export function getDefaultMenu(restaurant) {
  if (restaurant.menu?.length) return restaurant.menu;
  return commonMenu;
}

export function getSeededReviews() {
  return seededReviews;
}

export function getRestaurantStats(restaurant, extraReviews = []) {
  const seedReviewCount =
    typeof restaurant.reviews === "number"
      ? restaurant.reviews
      : restaurant.reviewCount ?? seededReviews.length;
  const seedReviewList = Array.isArray(restaurant.reviews)
    ? restaurant.reviews
    : seededReviews;
  const seedAverage = seedReviewList.length
    ? seedReviewList.reduce((sum, review) => sum + Number(review.rating), 0) /
      seedReviewList.length
    : Number(restaurant.rating) || 0;
  const baseCount = Math.max(seedReviewCount - seedReviewList.length, 0);
  const extraCount = extraReviews.length;
  const weightedTotal =
    Number(restaurant.rating) * baseCount +
    seedReviewList.reduce(
      (sum, review) => sum + Number(review.rating),
      0,
    ) +
    extraReviews.reduce((sum, review) => sum + Number(review.rating), 0);
  const reviewCount = seedReviewCount + extraCount;
  const average = reviewCount ? weightedTotal / reviewCount : seedAverage;
  return {
    rating: Number(average.toFixed(1)),
    reviewCount,
  };
}
