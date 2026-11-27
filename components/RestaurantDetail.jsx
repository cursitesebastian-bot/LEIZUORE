"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./RestaurantDetail.module.css";

export default function RestaurantDetail({ restaurantId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [reservationStatus, setReservationStatus] = useState("idle");
  const [reservationError, setReservationError] = useState("");
  const [reservation, setReservation] = useState(null);
  const [ownerReference, setOwnerReference] = useState("");
  const [ownerStatus, setOwnerStatus] = useState("");
  const [reviewReference, setReviewReference] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewFilter, setReviewFilter] = useState("All reviews");
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [demoRole, setDemoRole] = useState("diner");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/restaurants/${restaurantId}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Restaurant could not be loaded.");
        return result;
      })
      .then(setData)
      .catch((loadError) => {
        if (loadError.name !== "AbortError") setError(loadError.message);
      });
    return () => controller.abort();
  }, [restaurantId]);

  async function submitReservation(event) {
    event.preventDefault();
    if (!signedIn) {
      setReservationError("Sign in to request a table.");
      return;
    }
    setReservationStatus("submitting");
    setReservationError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: formData.get("name"),
          phone: formData.get("phone"),
          date: formData.get("date"),
          time: formData.get("time"),
          guests: formData.get("guests"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setReservation(result);
      setReservationStatus("confirmed");
      setReviewReference(result.reference);
    } catch (submitError) {
      setReservationError(submitError.message);
      setReservationStatus("idle");
    }
  }

  async function markComplete(event) {
    event.preventDefault();
    if (!signedIn || demoRole !== "owner") {
      setOwnerStatus("Restaurant owner sign-in is required.");
      return;
    }
    setOwnerStatus("");
    const response = await fetch(`/api/restaurants/${restaurantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", reference: ownerReference }),
    });
    const result = await response.json();
    if (!response.ok) {
      setOwnerStatus(result.error);
      return;
    }
    setOwnerStatus("Dining marked complete. The diner can now submit a review.");
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!signedIn) {
      setReviewStatus("Sign in to publish a verified review.");
      return;
    }
    setReviewStatus("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/restaurants/${restaurantId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "review",
        reference: formData.get("reference"),
        name: formData.get("name"),
        rating: formData.get("rating"),
        description: formData.get("description"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setReviewStatus(result.error);
      return;
    }
    setReviewStatus("Thanks. Your verified review is now published.");
    setData((current) => ({
      ...current,
      restaurant: {
        ...current.restaurant,
        rating: result.rating,
        reviews: result.reviewCount,
      },
    }));
  }

  if (error) return <main className={styles.page}><p role="alert">{error}</p></main>;
  if (!data) return <main className={styles.page}><p role="status">Loading restaurant…</p></main>;

  const { restaurant, reviews } = data;
  const galleryImages = restaurant.gallery?.length ? restaurant.gallery : [restaurant.image];
  const menuImages = restaurant.menuImages?.length
    ? restaurant.menuImages
    : galleryImages;
  const lightboxImages = [...galleryImages, ...menuImages];
  const reviewTags = [
    { label: "Great food", count: reviews.filter((review) => review.rating >= 4).length },
    { label: "Good value", count: reviews.filter((review) => review.rating >= 3).length },
    { label: "Food quality", count: reviews.filter((review) => review.description?.toLowerCase().includes("food")).length },
  ];
  const filteredReviews = reviews
    .slice()
    .reverse()
    .filter((review) => {
      if (reviewFilter === "Great food") return review.rating >= 4;
      if (reviewFilter === "Good value") return review.rating >= 3;
      if (reviewFilter === "Food quality") {
        return review.description?.toLowerCase().includes("food");
      }
      return true;
    });
  const visibleReviews = filteredReviews.slice(0, 6);
  const ratingBreakdown = {
    ambience: restaurant.ratingBreakdown?.ambience ?? (restaurant.rating - 0.2).toFixed(1),
    food: restaurant.ratingBreakdown?.food ?? (restaurant.rating + 0.1).toFixed(1),
    service: restaurant.ratingBreakdown?.service ?? (restaurant.rating - 0.1).toFixed(1),
  };

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/#dine-title">Dine nearby</Link>
        </div>

        <div className={styles.gallery}>
          {galleryImages.map((image, index) => (
            <button
              type="button"
              className={index === 0 ? styles.mainPhoto : styles.sidePhoto}
              key={image}
              style={{ "--photo": `url("${image}")` }}
              aria-label={`Open ${restaurant.name} photo ${index + 1} in full screen`}
              onClick={() => setGalleryIndex(index)}
            />
          ))}
        </div>

        <div className={styles.contentGrid}>
          <div>
            <header className={styles.restaurantHeader}>
              <div>
                <p className={styles.eyebrow}>{restaurant.cuisine}</p>
                <h1>{restaurant.name}</h1>
                <p className={styles.location}>
                  {restaurant.venue} · {restaurant.city}, {restaurant.district}, {restaurant.province}
                </p>
              </div>
              <div className={styles.ratingCard}>
                <span aria-label={`${restaurant.rating} star rating`}>★</span>
                <strong>{restaurant.rating}</strong>
                <small>{restaurant.reviews} dining reviews</small>
              </div>
            </header>

            <section className={styles.section} aria-labelledby="menu-title">
              <div className={styles.sectionHeading}>
                <h2 id="menu-title">Menu</h2>
                <span>Set by {restaurant.name}</span>
              </div>
              {restaurant.menu?.length ? (
                <div className={styles.menuGallery}>
                  {menuImages.map((image, index) => (
                    <button
                      type="button"
                      key={image}
                      className={styles.menuPage}
                      style={{ "--menu-photo": `url("${image}")` }}
                      aria-label={`Open menu page ${index + 1} in full screen`}
                      onClick={() => setGalleryIndex(galleryImages.length + index)}
                    />
                  ))}
                </div>
              ) : (
                <p>The restaurant menu is being updated.</p>
              )}
            </section>

            <section className={styles.section} aria-labelledby="reviews-title">
              <h2 id="reviews-title" className={styles.reviewHeading}>Ratings &amp; reviews</h2>
              <div className={styles.reviewSummary}>
                <div className={styles.reviewAverage}>
                  <strong>{Number(restaurant.rating).toFixed(1)}<span>★</span></strong>
                  <p>Based on {restaurant.reviews.toLocaleString()} ratings</p>
                </div>
                <div className={styles.ratingBreakdown}>
                  {[
                    ["Ambience", ratingBreakdown.ambience],
                    ["Food", ratingBreakdown.food],
                    ["Service", ratingBreakdown.service],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <h3>{restaurant.reviews.toLocaleString()} reviews</h3>
                <div className={styles.reviewFilters} aria-label="Filter review themes">
                  {reviewTags.map((tag) => (
                    <button
                      type="button"
                      key={tag.label}
                      aria-pressed={reviewFilter === tag.label}
                      onClick={() => setReviewFilter(tag.label)}
                    >
                      {tag.label}
                      {tag.count > 0 && <span>{tag.count}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.reviews}>
                {visibleReviews.map((review, index) => (
                  <article className={styles.review} key={`${review.name}-${index}`}>
                    <div className={styles.reviewTop}>
                      <span className={styles.reviewerAvatar} aria-hidden="true">
                        {review.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className={styles.reviewerMeta}>
                        <strong>{review.name}</strong>
                        <small>{review.verified ? "Verified dining" : "4 days ago"}</small>
                      </div>
                      <b className={review.rating <= 2 ? styles.lowRating : ""}>
                        {review.rating}.0 ★
                      </b>
                    </div>
                    <p>{review.description}</p>
                  </article>
                ))}
              </div>

              {signedIn ? (
              <form className={styles.reviewForm} onSubmit={submitReview}>
                <h3>Share a completed dining experience</h3>
                <div className={styles.formRow}>
                  <label>
                    Reservation reference
                    <input name="reference" defaultValue={reviewReference} required />
                  </label>
                  <label>
                    Name
                    <input name="name" required />
                  </label>
                  <label>
                    Rating
                    <select name="rating" defaultValue="5">
                      {[5, 4, 3, 2, 1].map((rating) => (
                        <option value={rating} key={rating}>{rating} stars</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Review
                  <textarea name="description" minLength={10} required placeholder="Tell others about the food and service" />
                </label>
                {reviewStatus && <p className={styles.formStatus}>{reviewStatus}</p>}
                <button className={styles.primaryButton} type="submit">Publish review</button>
              </form>
              ) : (
                <div className={styles.signInPrompt}>
                  <p>Sign in to publish a verified dining review.</p>
                  <button type="button" onClick={() => { setSignedIn(true); setDemoRole("diner"); }}>
                    Continue with Zoure
                  </button>
                </div>
              )}
            </section>

            <section className={styles.section} aria-labelledby="about-title">
              <h2 id="about-title">About</h2>
              <p>{restaurant.about ?? "A locally listed restaurant available to reserve through Leizoure."}</p>
              <div className={styles.detailsGrid}>
                <div><span>Average price</span><strong>{restaurant.price}</strong></div>
                <div><span>Hours</span><strong>{restaurant.hours ?? "Owner will confirm"}</strong></div>
                <div><span>Phone</span><strong>{restaurant.phone ?? "Added by owner"}</strong></div>
              </div>
              <div className={styles.facilities}>
                {(restaurant.facilities ?? ["Reservations", "Dine-in"]).map((facility) => (
                  <span key={facility}>{facility}</span>
                ))}
              </div>
            </section>
          </div>

          <aside className={styles.bookingCard}>
            <p className={styles.eyebrow}>Book a table</p>
            {!signedIn ? (
              <div className={styles.signInPrompt}>
                <p>Sign in to book a table or access restaurant tools.</p>
                <div className={styles.signInActions}>
                  <button type="button" onClick={() => { setSignedIn(true); setDemoRole("diner"); }}>
                    Sign in as diner
                  </button>
                  <button type="button" onClick={() => { setSignedIn(true); setDemoRole("owner"); }}>
                    Sign in as owner
                  </button>
                </div>
              </div>
            ) : reservationStatus === "confirmed" ? (
              <div className={styles.confirmation}>
                <span>✓</span>
                <h2>Reservation requested</h2>
                <p>{reservation.guests} guests · {reservation.date} at {reservation.time}</p>
                <small>Reference: {reservation.reference}</small>
              </div>
            ) : (
              <form className={styles.form} onSubmit={submitReservation}>
                <div className={styles.formRow}>
                  <label>Date<input name="date" type="date" required /></label>
                  <label>Time<input name="time" type="time" required /></label>
                </div>
                <label>Party size
                  <select name="guests" defaultValue="2">
                    {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                      <option value={count} key={count}>{count} guests</option>
                    ))}
                  </select>
                </label>
                <label>Name<input name="name" autoComplete="name" required /></label>
                <label>Phone<input name="phone" type="tel" autoComplete="tel" required /></label>
                {reservationError && <p className={styles.error}>{reservationError}</p>}
                <button className={styles.primaryButton} type="submit" disabled={reservationStatus === "submitting"}>
                  {reservationStatus === "submitting" ? "Requesting…" : "Reserve table"}
                </button>
              </form>
            )}

            {signedIn && demoRole === "owner" && (
              <details className={styles.ownerPanel}>
                <summary>Restaurant owner demo</summary>
                <form onSubmit={markComplete}>
                  <label>
                    Reservation reference
                    <input value={ownerReference} onChange={(event) => setOwnerReference(event.target.value)} required />
                  </label>
                  <button className={styles.secondaryButton} type="submit">Mark dining complete</button>
                </form>
                {ownerStatus && <p className={styles.formStatus}>{ownerStatus}</p>}
              </details>
            )}
          </aside>
        </div>
      </div>
      {galleryIndex !== null && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`${restaurant.name} photo viewer`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGalleryIndex(null);
          }}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            aria-label="Close photo viewer"
            onClick={() => setGalleryIndex(null)}
          >
            ×
          </button>
          {lightboxImages.length > 1 && (
            <button
              type="button"
              className={`${styles.lightboxArrow} ${styles.lightboxPrevious}`}
              aria-label="Previous photo"
              onClick={() => setGalleryIndex((galleryIndex - 1 + lightboxImages.length) % lightboxImages.length)}
            >
              ‹
            </button>
          )}
          <img src={lightboxImages[galleryIndex]} alt={`${restaurant.name} view ${galleryIndex + 1}`} />
          {lightboxImages.length > 1 && (
            <button
              type="button"
              className={`${styles.lightboxArrow} ${styles.lightboxNext}`}
              aria-label="Next photo"
              onClick={() => setGalleryIndex((galleryIndex + 1) % lightboxImages.length)}
            >
              ›
            </button>
          )}
          <span className={styles.lightboxCount}>
            {galleryIndex + 1} / {lightboxImages.length}
          </span>
        </div>
      )}
    </main>
  );
}
