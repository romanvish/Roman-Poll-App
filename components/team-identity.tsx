import Image from "next/image";
import Link from "next/link";

export function TeamLogo({ abbreviation, logoPath, size = "normal" }: { abbreviation: string; logoPath?: string | null; size?: "normal" | "small" }) {
  return <span className={`team-logo team-logo-${size}`} aria-hidden="true">
    {logoPath ? <Image src={logoPath} alt="" width={size === "small" ? 28 : 40} height={size === "small" ? 28 : 40} /> : <span>{abbreviation.slice(0, 3)}</span>}
  </span>;
}

export function TeamIdentity({ id, name, abbreviation, logoPath, linked = true }: { id: string | number; name: string; abbreviation?: string; logoPath?: string | null; linked?: boolean }) {
  const label = <><TeamLogo abbreviation={abbreviation ?? name} logoPath={logoPath} /><span>{name}</span></>;
  return linked ? <Link className="team-identity" href={`/teams/${encodeURIComponent(String(id))}`}>{label}</Link> : <span className="team-identity">{label}</span>;
}
