"use client";

import { useState } from "react";
import { nepalLocations } from "../data/nepalLocations";
import { useLocation } from "./LocationContext";
import styles from "./LocationPicker.module.css";

const emptyLocation = { province: "", district: "", city: "" };

export default function LocationPicker() {
  const { location, saveLocation } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(emptyLocation);
  const [error, setError] = useState("");

  const districts = draft.province ? nepalLocations[draft.province] : [];
  const canSave =
    draft.province &&
    districts?.includes(draft.district) &&
    draft.city.trim().length > 0;

  function togglePicker() {
    setDraft(location ?? emptyLocation);
    setError("");
    setIsOpen((open) => !open);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      saveLocation({ ...draft, city: draft.city.trim() });
      setIsOpen(false);
    } catch (saveError) {
      console.error("Could not save the selected location.", saveError);
      setError("Could not save your location. Please try again.");
    }
  }

  const buttonLabel = location ? location.city : "Set location";

  return (
    <div className={styles.locationPicker}>
      <button
        className={styles.locationButton}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="location-picker-dialog"
        aria-label={location ? `Change location from ${location.city}` : "Set your location"}
        onClick={togglePicker}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="10" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
        <span>{buttonLabel}</span>
      </button>

      {isOpen && (
        <div
          className={styles.locationDialog}
          id="location-picker-dialog"
          role="dialog"
          aria-labelledby="location-picker-title"
        >
          <h2 id="location-picker-title">Choose your location</h2>
          <p>Pick a province and district, then enter your city or municipality.</p>

          <form onSubmit={handleSubmit}>
            <label>
              Province
              <select
                value={draft.province}
                onChange={(event) =>
                  setDraft({
                    province: event.target.value,
                    district: "",
                    city: "",
                  })
                }
                required
              >
                <option value="">Select province</option>
                {Object.keys(nepalLocations).map((province) => (
                  <option value={province} key={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>

            <label>
              District
              <select
                value={draft.district}
                onChange={(event) =>
                  setDraft({ ...draft, district: event.target.value, city: "" })
                }
                disabled={!draft.province}
                required
              >
                <option value="">Select district</option>
                {districts?.map((district) => (
                  <option value={district} key={district}>
                    {district}
                  </option>
                ))}
              </select>
            </label>

            <label>
              City or municipality
              <input
                autoComplete="address-level2"
                value={draft.city}
                onChange={(event) =>
                  setDraft({ ...draft, city: event.target.value })
                }
                placeholder="e.g. Lalitpur"
                required
              />
            </label>

            {error && <p className={styles.error} role="alert">{error}</p>}

            <div className={styles.actions}>
              <button
                className={styles.cancelButton}
                type="button"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
              <button className={styles.saveButton} type="submit" disabled={!canSave}>
                Save location
              </button>
            </div>
          </form>
          <p className={styles.privacyNote}>Your saved location stays in this browser.</p>
        </div>
      )}
    </div>
  );
}
