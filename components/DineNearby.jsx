"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocation } from "./LocationContext";
import styles from "./DineNearby.module.css";

function formatDistance(distanceKm) {
  if (distanceKm === null || distanceKm === undefined) return null;
  if (distanceKm < 1) {
    return `${Math.max(50, Math.round(distanceKm * 1000 / 50) * 50)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

function getMinimumDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DineNearby() {
  const { location } = useLocation();
  const query = location ? new URLSearchParams(location).toString() : "";
  const [feed, setFeed] = useState({
    query: "",
    status: "idle",
    restaurants: [],
    scopeLabel: "",
  });
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [reservationStatus, setReservationStatus] = useState("idle");
  const [reservationError, setReservationError] = useState("");
  const [reservation, setReservation] = useState(null);
  const [minimumDate, setMinimumDate] = useState("");

  useEffect(() => {
    if (!query) {
      return undefined;
    }

    const controller = new AbortController();
    fetch(`/api/restaurants?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Could not load restaurants.");
        }
        return result;
      })
      .then((result) => {
        setFeed({
          query,
          status: "ready",
          restaurants: result.restaurants,
          scopeLabel: result.scopeLabel,
        });
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        setFeed({
          query,
          status: "error",
          restaurants: [],
          scopeLabel: "",
        });
      });

    return () => controller.abort();
  }, [query]);

  const currentFeed = feed.query === query ? feed : null;
  const status = !location ? "idle" : currentFeed?.status ?? "loading";
  const restaurants = currentFeed?.restaurants ?? [];
  function openReservation(restaurant) {
    setSelectedRestaurant(restaurant);
    setReservationStatus("idle");
    setReservationError("");
    setReservation(null);
    setMinimumDate(getMinimumDate());
  }

  function closeReservation() {
    setSelectedRestaurant(null);
    setReservationStatus("idle");
    setReservationError("");
  }

  async function submitReservation(event) {
    event.preventDefault();
    setReservationStatus("submitting");
    setReservationError("");

    const formData = new FormData(event.currentTarget);
    const details = {
      restaurantId: selectedRestaurant.id,
      name: formData.get("name"),
      phone: formData.get("phone"),
      date: formData.get("date"),
      time: formData.get("time"),
      guests: formData.get("guests"),
    };

    try {
      const response = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Reservation could not be completed.");
      }
      setReservation(result);
      setReservationStatus("confirmed");
    } catch (error) {
      setReservationError(error.message);
      setReservationStatus("idle");
    }
  }

  return (
    <section className={styles.section} aria-labelledby="dine-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Table reservations</p>
            <h2 className={styles.heading} id="dine-title">
              Dine nearby
            </h2>
            <p className={styles.subheading}>
              {location && currentFeed?.scopeLabel
                ? currentFeed.scopeLabel
                : "Restaurants and cafes near your selected location."}
            </p>
          </div>
        </header>

        {status === "loading" && (
          <p className={styles.message} role="status">Finding places to eat nearby…</p>
        )}
        {status === "error" && (
          <p className={styles.message} role="alert">Restaurants could not be loaded.</p>
        )}
        {status === "idle" && (
          <p className={styles.message}>
            Choose your province, district, and city in the navbar to find restaurants.
          </p>
        )}
        {status === "ready" && restaurants.length === 0 && (
          <p className={styles.message}>No restaurants are available in this area yet.</p>
        )}

        {status === "ready" && restaurants.length > 0 && (
          <div className={styles.restaurantRail}>
            {restaurants.map((restaurant) => {
              const distance = formatDistance(restaurant.distanceKm);
              return (
                <article className={styles.card} key={restaurant.id}>
                  <Link
                    className={styles.cardLink}
                    href={`/Restaurants/${restaurant.id}`}
                    aria-label={`Open ${restaurant.name} restaurant page`}
                  >
                    <div
                      className={styles.image}
                      role="img"
                      aria-label={`${restaurant.name} restaurant`}
                      style={{ "--restaurant-image": `url("${restaurant.image}")` }}
                    >
                      <span className={styles.cuisine}>{restaurant.cuisine}</span>
                    </div>
                  </Link>
                  <div className={styles.cardBody}>
                    <div className={styles.titleRow}>
                      <Link className={styles.cardTitleLink} href={`/Restaurants/${restaurant.id}`}>
                        <h3>{restaurant.name}</h3>
                      </Link>
                      <span className={styles.rating}><b aria-hidden="true">★</b>{restaurant.rating}</span>
                    </div>
                    <p className={styles.venue}>{restaurant.venue}</p>
                    <div className={styles.meta}>
                      {distance && <span>{distance}</span>}
                      <span>{restaurant.price} per person</span>
                    </div>
                    <button
                      className={styles.reserveButton}
                      type="button"
                      onClick={() => openReservation(restaurant)}
                    >
                      Reserve a table
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {selectedRestaurant && (
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReservation();
            }
          }}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservation-title"
          >
            {reservationStatus === "confirmed" ? (
              <div className={styles.confirmation}>
                <span className={styles.confirmIcon}>✓</span>
                <p className={styles.eyebrow}>Reservation confirmed</p>
                <h2 id="reservation-title">Table held at {reservation.restaurant}</h2>
                <p>
                  {reservation.guests} {reservation.guests === 1 ? "guest" : "guests"} ·{" "}
                  {reservation.date} at {reservation.time}
                </p>
                <p className={styles.reference}>Reference: {reservation.reference}</p>
                <button className={styles.reserveButton} type="button" onClick={closeReservation}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <button
                  className={styles.closeButton}
                  type="button"
                  aria-label="Close reservation"
                  onClick={closeReservation}
                >
                  ×
                </button>
                <p className={styles.eyebrow}>Reserve</p>
                <h2 id="reservation-title">{selectedRestaurant.name}</h2>
                <p className={styles.dialogVenue}>{selectedRestaurant.venue}</p>
                <form className={styles.form} onSubmit={submitReservation}>
                  <label>
                    Name
                    <input name="name" type="text" autoComplete="name" required />
                  </label>
                  <label>
                    Phone
                    <input name="phone" type="tel" autoComplete="tel" required />
                  </label>
                  <div className={styles.formRow}>
                    <label>
                      Date
                      <input name="date" type="date" min={minimumDate} required />
                    </label>
                    <label>
                      Time
                      <input name="time" type="time" required />
                    </label>
                  </div>
                  <label>
                    Party size
                    <select name="guests" defaultValue="2">
                      {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                        <option value={count} key={count}>
                          {count} {count === 1 ? "guest" : "guests"}
                        </option>
                      ))}
                    </select>
                  </label>
                  {reservationError && (
                    <p className={styles.error} role="alert">{reservationError}</p>
                  )}
                  <button
                    className={styles.reserveButton}
                    type="submit"
                    disabled={reservationStatus === "submitting"}
                  >
                    {reservationStatus === "submitting" ? "Requesting..." : "Confirm reservation"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
