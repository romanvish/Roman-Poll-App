export function SitePageHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  return <header className="site-page-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{detail && <p>{detail}</p>}</header>;
}
