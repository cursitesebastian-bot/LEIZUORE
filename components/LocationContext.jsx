"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { nepalLocations } from "../data/nepalLocations";

const LocationContext = createContext(null);
const STORAGE_KEY = "leizoure.saved-location";
const subscribers = new Set();
let cachedSerializedLocation;
let cachedLocation = null;

function isValidLocation(value) {
  return (
    value &&
    typeof value.province === "string" &&
    typeof value.district === "string" &&
    typeof value.city === "string" &&
    nepalLocations[value.province]?.includes(value.district) &&
    value.city.trim().length > 0
  );
}

function subscribe(callback) {
  subscribers.add(callback);
  window.addEventListener("storage", callback);

  return () => {
    subscribers.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getSavedLocation() {
  let serializedLocation;
  try {
    serializedLocation = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("Could not access the saved location.", error);
    return null;
  }

  if (serializedLocation === cachedSerializedLocation) {
    return cachedLocation;
  }

  cachedSerializedLocation = serializedLocation;
  cachedLocation = null;
  if (!serializedLocation) {
    return cachedLocation;
  }

  try {
    const parsedLocation = JSON.parse(serializedLocation);
    if (isValidLocation(parsedLocation)) {
      cachedLocation = parsedLocation;
    } else {
      console.error("Saved location is invalid and could not be restored.");
    }
  } catch (error) {
    console.error("Could not read the saved location.", error);
  }

  return cachedLocation;
}

function getServerLocation() {
  return null;
}

function saveLocation(nextLocation) {
  if (!isValidLocation(nextLocation)) {
    throw new Error("Select a valid province, district, and city.");
  }

  const serializedLocation = JSON.stringify(nextLocation);
  localStorage.setItem(STORAGE_KEY, serializedLocation);
  cachedSerializedLocation = serializedLocation;
  cachedLocation = nextLocation;
  subscribers.forEach((callback) => callback());
}

export function LocationProvider({ children }) {
  return (
    <LocationContext.Provider value={saveLocation}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const save = useContext(LocationContext);
  const location = useSyncExternalStore(
    subscribe,
    getSavedLocation,
    getServerLocation,
  );

  if (!save) {
    throw new Error("useLocation must be used within a LocationProvider.");
  }

  return { location, saveLocation: save };
}
