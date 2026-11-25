import styles from "./Navbar.module.css";
export default function Hero() {
  return (
    <section className={styles.picpart}>
      <main className={styles.boxfour} id="pic-4">
        <div className={styles.promoContent}>
        </div>
      </main>
      <main>
        <div className={`${styles.box} ${styles.promoPic1}`} id="pic-1">
          <div className={styles.promoContent}>
          </div>
        </div>
        <div className={`${styles.boxnumtwo} ${styles.promoPic2}`} id="pic-2">
          <div className={styles.promoContent}>
          </div>
        </div>
        <div className={`${styles.box} ${styles.promoPic3}`} id="pic-3">
          <div className={styles.promoContent}>
          </div>
        </div>
      </main>
    </section>
  );
}
