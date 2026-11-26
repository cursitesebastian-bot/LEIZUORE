"use client";

import { useEffect, useRef, useState } from "react";
import { useLocation } from "./LocationContext";
import styles from "./EventsSection.module.css";

function formatEventDate(value) {
  return new Date(value).toLocaleString("en-NP", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventsSection() {
  const { location } = useLocation();
  const eventRailRef = useRef(null);
  const [feed, setFeed] = useState({
    query: "",
    status: "idle",
    events: [],
    scopeLabel: "",
    error: "",
  });
  const query = location ? new URLSearchParams(location).toString() : "";

  useEffect(() => {
    if (!query) {
      return undefined;
    }

    const controller = new AbortController();

    fetch(`/api/events?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Could not load events.");
        }
        return result;
      })
      .then((result) => {
        setFeed({
          query,
          status: "ready",
          events: result.events,
          scopeLabel: result.scopeLabel,
          error: "",
        });
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }

        console.error("Could not load the local event feed.", error);
        setFeed({
          query,
          status: "error",
          events: [],
          scopeLabel: "",
          error: "Events could not be loaded. Please try again.",
        });
      });

    return () => controller.abort();
  }, [query]);

  const currentFeed = feed.query === query ? feed : null;
  const status = !location ? "idle" : currentFeed?.status ?? "loading";
  const events = currentFeed?.events ?? [];

  function scrollEvents(direction) {
    const rail = eventRailRef.current;
    if (!rail) {
      return;
    }

    rail.scrollBy({
      left: direction * rail.clientWidth * 0.8,
      behavior: "smooth",
    });
  }

  return (
    <section className={styles.section} aria-labelledby="events-heading">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="events-heading">Events &amp;</h2>
          <p className={styles.scope}>
            {location
              ? currentFeed?.scopeLabel || `${location.city}, ${location.district}, ${location.province}`
              : "Set your location in the top bar to see what is happening nearby."}
          </p>
        </div>
        {location && (
          <div className={styles.headerActions}>
            <span className={styles.locationSummary}>
              {location.city}, {location.district}
            </span>
            {events.length > 1 && (
              <div className={styles.railControls} aria-label="Event carousel controls">
                <button
                  className={styles.railButton}
                  type="button"
                  aria-label="Scroll to earlier events"
                  aria-controls="events-rail"
                  onClick={() => scrollEvents(-1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button
                  className={styles.railButton}
                  type="button"
                  aria-label="Scroll to later events"
                  aria-controls="events-rail"
                  onClick={() => scrollEvents(1)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {status === "loading" && (
        <p className={styles.message} role="status">Finding nearby events…</p>
      )}
      {status === "error" && (
        <p className={styles.message} role="alert">{currentFeed?.error}</p>
      )}
      {status === "idle" && (
        <p className={styles.message}>
          The demo listings are in Lalitpur. Set Lalitpur in the top bar to see all 10.
        </p>
      )}
      {status === "ready" && events.length === 0 && (
        <p className={styles.message}>
          There are no demo listings in {location.province} yet.
        </p>
      )}
      {status === "ready" && events.length > 0 && (
        <div
          ref={eventRailRef}
          className={styles.eventRail}
          id="events-rail"
          role="region"
          aria-label="Nearby events and activities"
        >
          {events.map((event) => (
            <article className={styles.eventCard} key={event.id}>
              <div
                className={styles.eventPoster}
                role="img"
                aria-label={`${event.kind} poster for ${event.title}`}
                style={{ "--event-image": `url("${event.posterUrl}")` }}
              />
              <div className={styles.eventDetails}>
                <h3>{event.title}</h3>
                <p className={styles.venue}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  <span>{event.venue}, {event.city}</span>
                </p>
                <time dateTime={event.startsAt}>{formatEventDate(event.startsAt)}</time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
