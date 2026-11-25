"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";
const navItems = [
  { label: "Events", href: "/Events" },
  { label: "Activities", href: "/Activities" },
  { label: "fitness", href: "/fitness" },
  { label: "Shows", href: "/shows" },
  { label: "Bites" , href: "/Bites"},
]

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className={styles.appleLikeNavbar}>
      <div className={styles.navbarInner}>
    
        <Link href="/" className={styles.brandLink} aria-label="Leizoure Home">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <rect width="48" height="48" rx="16" fill="" />
         <path
            d="M11.5 33.5c4.6-1.8 8.2-5.4 10.6-10.5 1.8-3.8 4.4-5.5 7.6-5.5"
            stroke="#000000"
            strokeLinecap="round"
            strokeWidth="3.4"
             />
  
         <path
            d="M25.5 34v-6.5M31 34v-11M36.5 34v-4.5"
            stroke="#000000"
            strokeLinecap="round"
            strokeWidth="3.2"
         />
  
         <circle cx="35.5" cy="13.5" r="4.2" fill="#000000" />
          </svg>
        </Link>
        <nav className={styles.navLinks} aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.isActive : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.navActions}>
          <Link href="/search" className={styles.iconBtn} aria-label="Search">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"width="24"height="24" fill="none"
>            <circle cx="21" cy="21" r="12" stroke="currentColor" strokeWidth="3.2"/>
             <path d="M30 30L40 40" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
            </svg>
          </Link>
          <Link href="/saved" className={styles.iconBtn} aria-label="Saved">
            
          </Link>
        </div>
      </div>
    </header>
  );
}