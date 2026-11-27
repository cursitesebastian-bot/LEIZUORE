"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./TrendingThisWeek.module.css";
import { useLocation } from "./LocationContext";
import {
  FILTERS,
  MAX_ITEMS,
  filterByDay,
  formatDistance,
  formatWhen,
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

export default function TrendingThisWeek() {
  const { location } = useLocation();
  const query = location ? new URLSearchParams(location).toString() : "";
  const [filter, setFilter] = useState("week");
  const [feed, setFeed] = useState({
    query: "",
    status: "idle",
    events: [],
    scopeLabel: "",
    distanceFrom: null,
    error: "",
    now: null,
  });

  useEffect(() => {
    if (!query) {
      return undefined;
    }

    const controller = new AbortController();

    fetch(`/api/trending?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Could not load trending events.");
        }
        return result;
      })
      .then((result) => {
        setFeed({
          query,
          status: "ready",
          events: result.events.map((event) => ({
            ...event,
            start: new Date(event.startsAt),
          })),
          scopeLabel: result.scopeLabel,
          distanceFrom: result.distanceFrom,
          error: "",
          now: new Date(),
        });
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }

        console.error("Could not load trending events.", error);
        setFeed({
          query,
          status: "error",
          events: [],
          scopeLabel: "",
          distanceFrom: null,
          error: "Trending events could not be loaded. Please try again.",
          now: null,
        });
      });

    return () => {
      controller.abort();
    };
  }, [query]);

  const currentFeed = feed.query === query ? feed : null;
  const status = !location ? "idle" : currentFeed?.status ?? "loading";
  const weekEvents = useMemo(
    () => currentFeed?.events ?? [],
    [currentFeed],
  );
  const now = currentFeed?.now;
  const filters = useMemo(
    () =>
      FILTERS.map((item) => ({
        ...item,
        count: now ? filterByDay(weekEvents, item.id, now).length : 0,
      })).filter((item) => item.id === "week" || item.count > 0),
    [weekEvents, now],
  );
  const activeFilter = filters.some((item) => item.id === filter) ? filter : "week";
  const shown = now
    ? filterByDay(weekEvents, activeFilter, now).slice(0, MAX_ITEMS)
    : [];
  const [featured, ...rest] = shown;
  const featuredWhen = featured ? formatWhen(featured.start, now) : null;

  return (
    <section className={styles.section} aria-labelledby="trending-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <h2 className={styles.heading} id="trending-title">
              Trending this week
            </h2>
            <p className={styles.subheading}>
              {location && currentFeed?.scopeLabel
                ? `${currentFeed.scopeLabel} · next 7 days`
                : "Popular events and activities near your selected location."}
              {currentFeed?.distanceFrom &&
                ` · Approximate distance from ${currentFeed.distanceFrom}`}
            </p>
          </div>

          {status === "ready" && filters.length > 1 && (
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

        {status === "loading" && (
          <p className={styles.subheading} role="status">Finding events near you…</p>
        )}
        {status === "error" && (
          <p className={styles.subheading} role="alert">{currentFeed?.error}</p>
        )}
        {status === "idle" && (
          <p className={styles.subheading}>
            Choose your province, district, and city in the navbar to find events nearby.
          </p>
        )}
        {status === "ready" && weekEvents.length === 0 && (
          <p className={styles.subheading}>
            No upcoming events were found this week in {location.province}.
          </p>
        )}
        {featured && (
          <>
            <div className={styles.layout}>
              <Link
                className={styles.featured}
                href={featured.href}
                style={{ "--event-image": `url("${featured.image}")` }}
              >
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
          </>
        )}
      </div>
    </section>
  );
}
