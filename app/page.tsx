"use client";

import { useMemo } from "react";
import Link from "next/link";
import AppTabNav from "@/app/components/AppTabNav";
import AffiliationPrompt from "@/app/components/home/AffiliationPrompt";
import AnnualReportBanner from "@/app/components/home/AnnualReportBanner";
import HomeContact from "@/app/components/home/HomeContact";
import HomeEntryCards from "@/app/components/home/HomeEntryCards";
import HomeHelp from "@/app/components/home/HomeHelp";
import HomeHero from "@/app/components/home/HomeHero";
import HomeRegisterPrompt from "@/app/components/home/HomeRegisterPrompt";
import HomeSchedule from "@/app/components/home/HomeSchedule";
import { useHomeTeams } from "@/app/components/home/useHomeTeams";
import { useAuth } from "@/app/lib/auth";
import { canFileOfficialReport } from "@/lib/home/membership";
import "./components/home/home.css";

const NO_TEAMS: string[] = [];

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";
  const { teams, status: teamStatus } = useHomeTeams(userId, authLoading);
  const teamIds = useMemo(() => teams.map((team) => team.id), [teams]);
  const noTeam = teamStatus === "ready" && teams.length === 0;
  const hasTeam = teamStatus === "ready" && teams.length > 0;
  const canFileReport = canFileOfficialReport(teams);

  if (authLoading) {
    return (
      <main className="home-page">
        <AppTabNav />
        <p className="home-loading">読み込み中…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="home-page">
        {/* signed-out-home */}
        <AppTabNav />
        <HomeHero />
        <HomeEntryCards signedIn={false} />
        <HomeSchedule mode="guest" teamIds={NO_TEAMS} heading="h2" />
        <HomeHelp guideInitiallyOpen={true} />
        <HomeContact />
      </main>
    );
  }

  const scheduleMode =
    teamStatus === "error" ? "unknown" : teamStatus === "ready" ? "ready" : "checking";

  return (
    <main className="home-page">
      {/* signed-in-home */}
      <AppTabNav />
      {noTeam ? <HomeRegisterPrompt /> : null}
      {hasTeam && canFileReport ? <AnnualReportBanner userId={user.id} /> : null}
      {hasTeam && canFileReport ? <AffiliationPrompt /> : null}
      <HomeSchedule
        mode={scheduleMode}
        teamIds={teamIds}
        heading={noTeam ? "h2" : "h1"}
      />
      <HomeEntryCards signedIn />
      {hasTeam ? (
        <p className="home-mypage">{"チームの登録内容は"}<Link href="/mypage" className="home-inline-link">マイページ</Link>{"で見られます。"}</p>
      ) : null}
      <HomeHelp guideInitiallyOpen={false} />
      <HomeContact />
    </main>
  );
}
