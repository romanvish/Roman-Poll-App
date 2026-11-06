import Link from "next/link";

export function SiteFooter() {
  return <footer className="site-footer">
    <div className="page-shell footer-inner">
      <div><span className="footer-mark" aria-hidden="true">RP</span><p>Independent rankings.<br />A poll among friends.</p></div>
      <nav aria-label="Footer navigation"><Link href="/">Rankings</Link><Link href="/polls">Poll archive</Link><Link href="/ballots">Ballots</Link><Link href="/compare">Compare</Link><Link href="/about">About the voters</Link></nav>
      <p className="footer-note">Roman Poll<br />College football. Our perspective.</p>
    </div>
  </footer>;
}
