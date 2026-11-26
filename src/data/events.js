// Put this file at: data/events.js
//
// TEMPORARY demo data. Dates are built relative to "now" so the section
// always has something to show while you build the frontend.
// When the backend is ready, delete this file and pass real events to
// <TrendingThisWeek events={...} />. Each event only needs the fields below.
//
//   id, title, category, image, venue, startsAt (ISO string),
//   lat, lng (venue coordinates), going (people booked/interested), href

const at = (daysFromNow, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

export const events = [
  {
    id: "night-run",
    title: "Lalitpur Night Run",
    category: "fitness",
    venue: "Jawalakhel Sports Ground",
    startsAt: at(0, 19, 0),
    lat: 27.6727,
    lng: 85.3141,
    going: 420,
    href: "/Events/night-run",
    image:
      "https://i.pinimg.com/1200x/f1/d5/45/f1d545e18f5dac08858e6c65fa92fd3b.jpg",
  },
  {
    id: "live-music-garden",
    title: "Live Music in the Garden",
    category: "shows",
    venue: "Godavari Botanical Garden",
    startsAt: at(1, 18, 0),
    lat: 27.5961,
    lng: 85.377,
    going: 260,
    href: "/Events/live-music-garden",
    image:
      "https://i.pinimg.com/1200x/39/d4/53/39d4534b8ff79ca4428eb89138192fc0.jpg",
  },
  {
    id: "food-culture-festival",
    title: "Lalitpur Food & Culture Festival",
    category: "bites",
    venue: "Patan Museum Courtyard",
    startsAt: at(2, 15, 0),
    lat: 27.6727,
    lng: 85.3253,
    going: 1350,
    href: "/Events/food-culture-festival",
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "art-makers-market",
    title: "Patan Art & Makers Market",
    category: "outdoors",
    venue: "Patan Durbar Square",
    startsAt: at(3, 11, 0),
    lat: 27.6727,
    lng: 85.3253,
    going: 180,
    href: "/Events/art-makers-market",
    image:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: "climbing-session",
    title: "Climbing Session",
    category: "fitness",
    venue: "Mangal Bazaar, Lalitpur",
    startsAt: at(4, 10, 0),
    lat: 27.6735,
    lng: 85.3243,
    going: 36,
    href: "/Events/climbing-session",
    image:
      "https://i.pinimg.com/1200x/23/56/00/235600b40d04618d05809341a8b166f8.jpg",
  },
  {
    id: "open-air-music-night",
    title: "Patan Open-Air Music Night",
    category: "shows",
    venue: "Pulchowk Amphitheatre",
    startsAt: at(5, 18, 30),
    lat: 27.6781,
    lng: 85.3174,
    going: 900,
    href: "/Events/open-air-music-night",
    image:
      "https://i.pinimg.com/1200x/18/d0/3c/18d03c1a5d5c3a4ad989a996abdf1543.jpg",
  },
  {
    id: "weekend-football-cup",
    title: "Lalitpur Weekend Football Cup",
    category: "fitness",
    venue: "Satdobato Sports Complex",
    startsAt: at(6, 9, 0),
    lat: 27.65,
    lng: 85.325,
    going: 520,
    href: "/Events/weekend-football-cup",
    image:
      "https://i.pinimg.com/1200x/f1/d5/45/f1d545e18f5dac08858e6c65fa92fd3b.jpg",
  },
  // These two should NOT show up: one is too far, one is next week.
  {
    id: "pokhara-festival",
    title: "Pokhara Lakeside Festival",
    category: "shows",
    venue: "Lakeside, Pokhara",
    startsAt: at(3, 17, 0),
    lat: 28.2096,
    lng: 83.9856,
    going: 2200,
    href: "/Events/pokhara-festival",
    image:
      "https://i.pinimg.com/1200x/39/d4/53/39d4534b8ff79ca4428eb89138192fc0.jpg",
  },
  {
    id: "next-week-market",
    title: "Next Week Night Market",
    category: "bites",
    venue: "Patan Durbar Square",
    startsAt: at(10, 17, 0),
    lat: 27.6727,
    lng: 85.3253,
    going: 300,
    href: "/Events/next-week-market",
    image:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=85",
  },
];
