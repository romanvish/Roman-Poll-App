import Image from "next/image";

export function PublicVoterAvatar({ name, avatarPath, size = "normal" }: { name: string; avatarPath: string | null; size?: "normal" | "small" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  return <span className={`public-voter-avatar public-voter-avatar-${size}`} aria-hidden="true">
    {avatarPath ? <Image src={avatarPath} alt="" width={size === "small" ? 42 : 76} height={size === "small" ? 42 : 76} /> : initials}
  </span>;
}
