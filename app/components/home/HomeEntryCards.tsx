"use client";

import Link from "next/link";
import { IconFlag, IconPlus, IconSearch } from "@/app/components/ui/Icons";
import { SelectionSection } from "@/app/home/components/SelectionSection";

const RECRUIT_PATH = "/match/new";

export default function HomeEntryCards({ signedIn }: { signedIn: boolean }) {
  const recruitHref = signedIn
    ? RECRUIT_PATH
    : `/login?redirect=${encodeURIComponent(RECRUIT_PATH)}`;

  return (
    <div className="home-cards">
      <Link href="/teams/search" className="home-card">
        <span className="home-card-icon" aria-hidden="true"><IconSearch /></span>
        <h2 className="home-card-title">練習試合を探す</h2>
        <span className="home-card-cta">探す</span>
      </Link>

      <Link href={recruitHref} className="home-card">
        <span className="home-card-icon" aria-hidden="true"><IconPlus /></span>
        <h2 className="home-card-title">試合を募集する</h2>
        <span className="home-card-cta">募集</span>
      </Link>

      <SelectionSection />
    </div>
  );
}
