"use client";

import Link from "next/link";
import { SelectionSection } from "@/app/home/components/SelectionSection";

const RECRUIT_PATH = "/match/new";

export default function HomeEntryCards({ signedIn }: { signedIn: boolean }) {
  const recruitHref = signedIn
    ? RECRUIT_PATH
    : `/login?redirect=${encodeURIComponent(RECRUIT_PATH)}`;

  return (
    <div className="home-cards">
      <Link href="/teams/search" className="home-card">
        <h2 className="home-card-title">練習試合を探す</h2>
        <p className="home-card-text">
          エリアやカテゴリから、練習試合の相手を探せます。
        </p>
        <span className="home-card-cta">相手を探す</span>
      </Link>

      <Link href={recruitHref} className="home-card">
        <h2 className="home-card-title">試合を募集する</h2>
        <p className="home-card-text">
          日付と条件を決めて、練習試合の相手を募集できます。
        </p>
        <span className="home-card-cta">募集を作る</span>
      </Link>

      <SelectionSection />
    </div>
  );
}
