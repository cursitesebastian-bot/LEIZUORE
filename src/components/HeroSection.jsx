import styles from "./Navbar.module.css";
export default function Hero(){
    return (
        <>
        <section className={styles.picpart}>
            <main className={styles.boxfour}>
                <div>
                    <div>
                        <p>pic 4</p>
                    </div>
                </div>
            </main>
            <main>
                <div className={styles.box}>
                <div>
                    <h>Pic 1</h>
                </div>
            </div>
            <div className={styles.boxnumtwo}>
                <div>
                    <h>Pic 2</h>
                </div>
            </div>
            <div className={styles.box}>
                <div>
                    <div>
                        <h>Pic 3</h>
                    </div>
                </div>
            </div>
            </main>
        </section>
        </>
    )
}