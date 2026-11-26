"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./TrendingThisWeek.module.css";
import { events as demoEvents } from "../data/events";
import {
  DEFAULT_LOCATION,
  FILTERS,
  MAX_ITEMS,
  RADIUS_KM,
  filterByDay,
  formatDistance,
  formatWhen,
  getWeekEvents,
  sizeInfo,
} from "../data/trending";

function PinIcon() {
  return (
    <svg
      className={styles.pin}width="14"height="14"viewBox="0 0 24 24"  fill="none" stroke="currentColor"  strokeWidth="2" strokeLinecap="round"  strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function Facts({ event }) {
  const distance = formatDistance(event.distanceKm);
  const size = sizeInfo(event.going);
  return (
    <div className={styles.facts}>
      {distance && <span className={styles.fact}>{distance}</span>}
      <span className={styles.fact}>
        {size.label}, {size.text}
      </span>
    </div>
  );
}

// Props:
//   events   - list of events (defaults to demo data, swap for backend data)
//   location - the user's chosen location: { name, lat, lng }
export default function TrendingThisWeek({
  events = demoEvents,
  location = DEFAULT_LOCATION,
}) {
  const [now, setNow] = useState(null);
  const [filter, setFilter] = useState("week");

  // "now" is set after the page loads so server and browser always agree.
  useEffect(() => {
    setNow(new Date());
  }, []);

  const weekEvents = useMemo(
    () => (now ? getWeekEvents(events, location, now) : []),
    [events, location, now]
  );

  // Only offer day filters that actually have events.
  const filters = useMemo(
    () =>
      FILTERS.map((f) => ({
        ...f,
        count: now ? filterByDay(weekEvents, f.id, now).length : 0,
      })).filter((f) => f.id === "week" || f.count > 0),
    [weekEvents, now]
  );

  // No events this week near the user: don't show the section at all.
  if (!now || weekEvents.length === 0) return null;

  const activeFilter = filters.some((f) => f.id === filter) ? filter : "week";
  const shown = filterByDay(weekEvents, activeFilter, now).slice(0, MAX_ITEMS);
  const [featured, ...rest] = shown;
  const featuredWhen = formatWhen(featured.start, now);

  return (
    <section className={styles.section} aria-labelledby="trending-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.heading} id="trending-title">
              Trending this week
            </h2>
            <p className={styles.subheading}>
              Most popular events within {RADIUS_KM} km of {location.name}.
            </p>
          </div>

          {filters.length > 1 && (
            <div className={styles.filters} role="group" aria-label="Filter by day">
              {filters.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  className={styles.filter}
                  aria-pressed={activeFilter === f.id}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className={styles.layout}>
          <Link
            className={styles.featured}
            href={featured.href}
            style={{ "--event-image": `url("${featured.image}")` }}
          >
            <span className={styles.rankBig} aria-hidden="true">
              
            </span>
            <span className={styles.featuredBody}>
              <strong className={styles.featuredTitle}>{featured.title}</strong>
              <span className={styles.when}>
                <b>{featuredWhen.day}</b>, {featuredWhen.time}
              </span>
              <span className={styles.venue}>
                <PinIcon />
                {featured.venue}
              </span>
              <Facts event={featured} />
            </span>
          </Link>

         {rest.length > 0 && (
            <ol className={styles.list}>
              {rest.map((event) => {
                const when = formatWhen(event.start, now);
                return (
                  <li key={event.id}>
                    <Link className={styles.row} href={event.href}>
                      <span
                        className={styles.thumb}
                        style={{ "--event-image": `url("${event.image}")` }}
                        aria-hidden="true"
                      />
                      <span className={styles.rowBody}>
                        <strong className={styles.rowTitle}>{event.title}</strong>
                        <span className={styles.when}>
                          <b>{when.day}</b>, {when.time}
                        </span>
                        <span className={styles.venue}>
                          <PinIcon />
                          {event.venue}
                        </span>
                        <Facts event={event} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <Link className={styles.seeAll} href="/Events?when=week">
          See all events this week
        </Link>
      </div>
    </section>
  );
}
