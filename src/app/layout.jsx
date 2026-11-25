import "./globals.css";
import LogoAnimation from "../components/logo-animation";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Leizoure — happy time",
  description:
    "Find nearby concerts, running groups, cycling routes, and little reasons to get out.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LogoAnimation>
          <Navbar />
        </LogoAnimation>
        <main>{children}</main>
      </body>
    </html>
  );
}