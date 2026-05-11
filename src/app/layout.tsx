import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aurum | حاسبة استثمار الذهب",
  description: "احسب استثماراتك في الذهب واكتشف أفضل الخيارات لميزانيتك.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <header>
          <Link href="/" className="logo">
            <span className="logo-icon">🪙</span>
            أوروم
          </Link>
          <nav>
            <Link href="/">الحاسبة</Link>
            <Link href="/dashboard">الإدارة</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
