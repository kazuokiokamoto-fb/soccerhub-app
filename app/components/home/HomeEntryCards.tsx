"use client";

import Link from "next/link";
import { IconChat, IconPlus, IconSearch } from "@/app/components/ui/Icons";

const RECRUIT_PATH = "/match/new";

export default function HomeEntryCards({ signedIn }: { signedIn: boolean }) {
  const recruitHref = signedIn
    ? RECRUIT_PATH
    : `/login?redirect=${encodeURIComponent(RECRUIT_PATH)}`;

  return (
    <div className="home-big-row">
      <Link href="/teams/search" className="home-big">
        <span className="home-big-icon" aria-hidden="true"><IconSearch size={28} /></span>
        探す
      </Link>
      <Link href={recruitHref} className="home-big">
        <span className="home-big-icon" aria-hidden="true"><IconPlus size={28} /></span>
        募集
      </Link>
      <Link href="/chat" className="home-big">
        <span className="home-big-icon" aria-hidden="true"><IconChat size={28} /></span>
        チャット
      </Link>
    </div>
  );
}
