import type { Metadata } from "next";
import { dirOf } from "@/i18n/locale";
import { productName } from "@/i18n/brand";
import { getLocale } from "./_lib/locale";
import "./globals.css";

/** The tab title is the product's full name in the reader's language (FB-2). */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: productName(locale),
    description: `${productName(locale)}: signal, insight, decision, action, outcome.`,
  };
}

/** Language and direction come from the viewer's choice (English LTR, Hebrew RTL; Eran, 2026-10-05). */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- one stylesheet for the whole app (root layout) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Hebrew:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
