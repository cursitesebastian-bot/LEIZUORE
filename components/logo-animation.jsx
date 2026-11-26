"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./logo-animation.module.css";

const introStorageKey = "leizoure:logo-intro-complete-v2";
const introStatusEvent = "leizoure:intro-status-change";

function subscribeToIntroStatus(onChange) {
  window.addEventListener(introStatusEvent, onChange);
  return () => window.removeEventListener(introStatusEvent, onChange);
}
function getIntroStatus() {
  return window.sessionStorage.getItem(introStorageKey) ? "seen" : "new";
}

function getServerIntroStatus() {
  return "checking";
}

function LogoMark() {
  return (
   <svg
  aria-hidden="true"
  className={styles.logo}
  fill="none"
  viewBox="0 0 48 48"
>
  <rect width="48" height="48" rx="16" fill="currentColor" />
  {/* Smooth outing / motion arc */}
  <path
    d="M11.5 33.5c4.6-1.8 8.2-5.4 10.6-10.5 1.8-3.8 4.4-5.5 7.6-5.5"
    stroke="#ffffff"
    strokeLinecap="round"
    strokeWidth="3.4"
  />
  {/* Concert / pulse beat bars */}
  <path
    d="M25.5 34v-6.5M31 34v-11M36.5 34v-4.5"
    stroke="#ffffff"
    strokeLinecap="round"
    strokeWidth="3.2"
  />
  {/* Spotlight / night-out node */}
  <circle cx="35.5" cy="13.5" r="4.2" fill="#ffffff" />
</svg>
  );
}

export default function LogoAnimation({ children }) {
  const introStatus = useSyncExternalStore(
    subscribeToIntroStatus,
    getIntroStatus,
    getServerIntroStatus,
  );
  const [phase, setPhase] = useState("visible");

  useEffect(() => {
    if (introStatus !== "new") {
      return;
    }

    const leaveTimer = window.setTimeout(() => setPhase("leaving"), 2650);
    const removeTimer = window.setTimeout(() => {
      window.sessionStorage.setItem(introStorageKey, "true");
      window.dispatchEvent(new Event(introStatusEvent));
      setPhase("done");
    }, 3000);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, [introStatus]);

  const hideNavbar =
    introStatus === "checking" || (introStatus === "new" && phase !== "done");
  const showOverlay =
    introStatus === "new" && (phase === "visible" || phase === "leaving");

  return (
    <>
      <div className={hideNavbar ? styles.navbarHidden : undefined}>{children}</div>
      {showOverlay && (
        <div
          aria-label="Leizoure logo animation"
          className={`${styles.overlay}${phase === "leaving" ? ` ${styles.leaving}` : ""}`}
          role="status"
        >
          <div className={styles.mark}>
            <LogoMark />
          </div>
        </div>
      )}
    </>
  );
}
