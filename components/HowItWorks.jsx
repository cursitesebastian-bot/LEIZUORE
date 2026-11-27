import styles from "./HowItWorks.module.css";

const steps = [
  {
    number: "01",
    title: "Set your place",
    text: "Choose your province, district, and city. Zoure keeps it on this device for a more personal feed.",
  },
  {
    number: "02",
    title: "Find what is happening",
    text: "Explore events and restaurants nearby, with a city and district fallback before province-wide results.",
  },
  {
    number: "03",
    title: "Reserve or go",
    text: "Sign in to book a table or complete a booking, then share a verified review after your visit.",
  },
];

export default function HowItWorks() {
  return (
    <section className={styles.section} aria-labelledby="how-it-works-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>How Zoure works</p>
          <h2 id="how-it-works-title">Discover more of your city</h2>
        </header>
        <div className={styles.grid}>
          {steps.map((step) => (
            <article className={styles.step} key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
