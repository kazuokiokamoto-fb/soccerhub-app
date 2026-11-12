"use client";

import TeamProfileCard from "@/app/teams/components/TeamProfileCard";

const team = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_id: null,
  name: "青葉FC",
  category: "U12",
  categories: ["U12"],
  level: 7,
  strength_rank: "S",
  area: "東京都 世田谷",
  prefecture: "東京都",
  city: "世田谷区",
  town: null,
  member_count: 18,
  uniform_main: "青",
  uniform_sub: "白",
  note: null,
};

export default function TeamCardFixture() {
  return (
    <TeamProfileCard
      title="チーム詳細"
      team={team}
      myUserId=""
      showChatButton={false}
      showGeminiSection={false}
      showEditButton={false}
      showAddressDetail={false}
      leagueLevel="prefecture"
      leagueDivision={3}
    />
  );
}
