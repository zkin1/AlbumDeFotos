import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nuestro álbum",
  description: "Nuestros recuerdos en un álbum de fotos para explorar, barajar y volver a mirar.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
