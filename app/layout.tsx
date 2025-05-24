import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BakuEdu", // Default title
    template: "%s | BakuEdu", // Title template for child pages
  },
  description: "Organize your tasks with BakuEdu.", // Optional: Updated description
  icons: {
    icon: "/favicon.ico", // Points to public/favicon.ico
    // You can add other icon types here if needed:
    // apple: "/apple-icon.png", 
    // shortcut: "/shortcut-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
