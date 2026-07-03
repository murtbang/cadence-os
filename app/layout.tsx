import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import IonicSetup from "@/components/IonicSetup";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Cadence",
  description: "Personal daily operating system",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#181b22",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable}`}>
        <IonicSetup />
        {children}
      </body>
    </html>
  );
}
