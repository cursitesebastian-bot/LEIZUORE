import { HostAuthProvider } from "@/components/host/HostAuth";
import styles from "./host.module.css";

export const metadata = {
  title: "Host your event — ZOURE",
};

// Organizer screens render per user after sign-in, so the segment may block instead of prerendering.
export const instant = false;

export default function HostLayout({ children }) {
  return (
    <HostAuthProvider>
      <div className={styles.host}>
        <div className={styles.page}>{children}</div>
      </div>
    </HostAuthProvider>
  );
}
