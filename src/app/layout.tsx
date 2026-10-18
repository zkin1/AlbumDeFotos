import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creative Space¹",
  description: "An interactive creative space. Eighteen studies in motion, with temporary neutral image placeholders.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
