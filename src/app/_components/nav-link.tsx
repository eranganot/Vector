"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sidebar link with the active state (the only client component in the shell). */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" || path.startsWith("/insights") : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm no-underline transition-colors ${
        active
          ? "border border-accent/50 bg-accent/10 font-semibold text-accent shadow-[0_0_18px_rgb(34_211_238/0.15)]"
          : "border border-transparent text-ink/85 hover:bg-soft"
      }`}
    >
      {children}
    </Link>
  );
}
