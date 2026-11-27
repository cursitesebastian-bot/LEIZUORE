import { formatNpr, formatWhen, CATEGORIES } from "@/lib/host/format";
import { minPrice } from "./eventForm";
import styles from "./EventPreview.module.css";

const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label ?? "Event";
const priceLabel = (f) => (f.paid ? `From ${formatNpr(minPrice(f))}` : "Free");

/** Approximation of how the event looks on ZOURE: the card in lists, then the event page. */
export default function EventPreview({ form, organizerName }) {
  const when = form.starts_at ? formatWhen(`${form.starts_at}:00+05:45`) : "Date not set";
  const where = form.is_online ? "Online" : form.venue_name || "Venue not set";

  return (
    <div className={styles.preview}>
      <div>
        <p className={styles.caption}>Event card</p>
        <article className={styles.card} style={form.cover_image_url ? { "--cover": `url("${form.cover_image_url}")` } : undefined}>
          <span className={styles.price}>{priceLabel(form)}</span>
          <div>
            <p>{categoryLabel(form.category)} · {when}</p>
            <h3>{form.title || "Your event name"}</h3>
            <p>{where}</p>
          </div>
        </article>
      </div>

      <div>
        <p className={styles.caption}>Event page</p>
        <article className={styles.page}>
          <h3>{form.title || "Your event name"}</h3>
          <p className={styles.host}>Hosted by {organizerName || "you"}</p>
          <p className={styles.meta}>{when}{form.repeat ? " · repeats weekly" : ""}</p>
          <p className={styles.meta}>{where}{!form.is_online && form.address ? `, ${form.address}` : ""}</p>
          <p className={styles.about}>{form.description || "Your description will appear here."}</p>
          <ul className={styles.tickets}>
            {form.tickets.filter((t) => t.name.trim()).map((t) => (
              <li key={t.key}>
                <span>{t.name}</span>
                <span>{form.paid ? formatNpr(Number(t.price) || 0) : "Free"}</span>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
