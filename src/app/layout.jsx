import "./globals.css";
import LogoAnimation from "../components/logo-animation";
import Navbar from "@/components/Navbar";
import { LocationProvider } from "../components/LocationContext";
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
});

export const metadata = {
  title: "Leizoure — happy time",
  description:
    "Find nearby concerts, running groups, cycling routes, and little reasons to get out.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={spaceGrotesk.variable}>
        <LocationProvider>
          <LogoAnimation>
            <Navbar />
          </LogoAnimation>
          <main>{children}</main>
        </LocationProvider>
      </body>
    </html>
  );
}