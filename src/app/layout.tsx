import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VECTOR",
  description: "Organizational intelligence: signal, insight, decision, action, outcome.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
