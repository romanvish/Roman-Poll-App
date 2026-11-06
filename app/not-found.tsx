import Link from "next/link";

export default function NotFound() {
  return <div className="page-shell account-page">
    <section className="empty-panel not-found-panel">
      <p className="eyebrow">Not found</p>
      <h1>This page isn’t available.</h1>
      <p>The poll edition or voter profile may not exist, or its poll may not be published.</p>
      <div className="published-page-links"><Link href="/">Back to rankings</Link><Link href="/polls">Poll archive</Link></div>
    </section>
  </div>;
}
