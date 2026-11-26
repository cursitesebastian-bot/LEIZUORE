import Link from "next/link";
import styles from "./BrowseByVibe.module.css";
import { vibes } from "../data/vibes";

export default function BrowseByVibe() {
  return (
    <section className={styles.section} aria-labelledby="vibe-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <h2 className={styles.heading} id="vibe-title">
            Browse by vibe
          </h2>
          <p className={styles.subheading}>
            Pick a mood and see what&apos;s on near you.
          </p>
        </header>

        <div className={styles.tiles}>
          {vibes.map((vibe) => (
            <Link
              className={styles.tile}
              href={vibe.href}
              key={vibe.id}
              style={{ "--vibe-image": `url("${vibe.image}")` }}
            >
              <span className={styles.go} aria-hidden="true">
                Browse {vibe.title.toLowerCase()}
              </span>
              <strong className={styles.name}>{vibe.title}</strong>
              <span className={styles.note}>{vibe.note}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
