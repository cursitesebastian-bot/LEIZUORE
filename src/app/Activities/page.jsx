import Link from "next/link";
import { activities } from "../../data/activities";
import styles from "./Activities.module.css";

export default function ActivitiesPage() {
  return (
    <section className={styles.page} aria-labelledby="activities-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Activity center</p>
        <h1 id="activities-title">Find your next favorite moment.</h1>
        <p>Browse activities and find something fun to do with your people.</p>
      </header>

      <div className={styles.grid}>
        {activities.map((activity) => (
          <article
            className={styles.activity}
            id={activity.id}
            key={activity.id}
            tabIndex={-1}
          >
            <h2>{activity.title.replace("\n", " ")}</h2>
            <p>{activity.note}</p>
          </article>
        ))}
      </div>

      <Link className={styles.homeLink} href="/">
        Back to home
      </Link>
    </section>
  );
}
