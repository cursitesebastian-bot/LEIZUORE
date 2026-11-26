import Link from "next/link";
import styles from "./HeroSection.module.css";
import { activities } from "../data/activities";

const posterGroups = [
  { className: styles.leftPosters, side: "right" },
  { className: styles.rightPosters, side: "left" },
];

export default function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.posterField}>
        {posterGroups.map((group) => (
          <div className={`${styles.posterGroup} ${group.className}`} key={group.side}>
            {activities
              .filter((activity) => activity.side === group.side)
              .map((activity) => (
                <article
                  className={`${styles.poster} ${styles[activity.style]}`}
                  key={activity.id}
                >
                  <strong className={styles.posterTitle}>
                    {activity.title.split("\n").map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </strong>
                  <span className={styles.posterNote}>{activity.note}</span>
                  <Link
                    className={styles.posterLink}
                    href={`/Activities#${activity.id}`}
                    aria-label={`View ${activity.title.replace("\n", " ")}`}
                  >
                    View activity
                  </Link>
                </article>
              ))}
          </div>
        ))}
      </div>

      <div className={styles.heroContent}>
        <h1 className={styles.title} id="hero-title">
          ZOURE
          <br />
          <p className={styles.miti}>events</p>
          <span>Fun Time</span>
        </h1>
        <p className={styles.description}>
          From run clubs to launch parties and live shows,<br/> find your next
          favorite moment.
        </p>
        <Link className={styles.cta} href="/Events">
          Explore events
        </Link>
      </div>
    </section>
  );
}
