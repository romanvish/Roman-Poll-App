import Link from "next/link";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { SitePageHeading } from "@/components/site-page-heading";
import { getPublishedPolls } from "@/lib/server/published-polls";

export const instant = false;

export default async function PollArchivePage() {
  await connection();
  const polls = await getPublishedPolls();
  return <div className="page-shell account-page">
    <SitePageHeading eyebrow="Published editions" title="The poll archive" detail="Rankings and ballots from every published week." />
    <div className="poll-archive-list">{polls.map((poll) => <Link key={`${poll.season}-${poll.week}`} href={`/polls/${poll.season}/${poll.week}`}><Card><CardContent className="poll-archive-row"><div><strong>{poll.label}</strong><span>{poll.season} · {poll.voters} voters</span></div><time dateTime={poll.publishedAt}>{new Date(poll.publishedAt).toLocaleDateString()}</time></CardContent></Card></Link>)}{polls.length === 0 && <Card><CardContent className="empty-state"><h2>No published poll yet</h2><p>Published editions will appear here.</p></CardContent></Card>}</div>
  </div>;
}
