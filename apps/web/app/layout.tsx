
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Trailtag — Digitaler Sicherheitsbegleiter für die Berge",
  description: "Ein QR-Code am Auto, der im Notfall sofort deinen Standort und deine Daten an Ersthelfer übermittelt. Ohne App-Installation für Retter. Für alle Bergsportler in der Schweiz.",
  keywords: ["Bergsicherheit", "Notfall", "Wandern", "Skitouren", "QR-Code", "Schweiz", "Alpin"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
