"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Rankings", active: pathname === "/" || pathname.startsWith("/polls") },
    { href: "/ballots", label: "Ballots", active: pathname.startsWith("/ballots") },
    { href: "/compare", label: "Compare", active: pathname.startsWith("/compare") },
    { href: "/about", label: "About", active: pathname === "/about" || pathname.startsWith("/voters/") },
    { href: "/polls", label: "Poll archive", active: false },
    { href: "/#how-it-works", label: "How it works", active: false },
    { href: "/sign-in", label: "Sign in", active: pathname.startsWith("/sign-in") },
  ];
  return <header className="site-header">
    <div className="page-shell header-inner">
      <Link href="/" className="brand" aria-label="Roman Poll home"><span aria-hidden="true">R</span><strong>Roman Poll</strong></Link>
      <nav className="desktop-nav" aria-label="Primary navigation">{links.map((link) => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined} className={link.active ? "active" : undefined}>{link.label}</Link>)}</nav>
      <details className="mobile-menu">
        <summary aria-label="Open navigation"><span /><span /><span /></summary>
        <nav aria-label="Mobile navigation" onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}>{links.map((link) => <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined}>{link.label}</Link>)}</nav>
      </details>
    </div>
  </header>;
}
