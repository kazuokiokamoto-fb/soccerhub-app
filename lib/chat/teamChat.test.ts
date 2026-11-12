import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { teamChatOpenErrorMessage } from "./teamChatError.ts";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20261112045942_fix_team_chat_open.sql",
    import.meta.url,
  ),
  "utf8",
);

const teamChatPage = readFileSync(
  new URL("../../app/chat/team/[teamId]/page.tsx", import.meta.url),
  "utf8",
);

const chatListPage = readFileSync(
  new URL("../../app/chat/page.tsx", import.meta.url),
  "utf8",
);

test("team chat failures stay in Japanese", () => {
  const rls = teamChatOpenErrorMessage({
    message: 'new row violates row-level security policy for table "chat_threads"',
    code: "42501",
  });
  assert.equal(rls, "しばらくしてから、もう一度お試しください。");
  assert.equal(rls.includes("chat_threads"), false);
  assert.equal(rls.includes("violates"), false);

  assert.equal(
    teamChatOpenErrorMessage(new Error("not a member of team")),
    "このチームのメンバーだけがチームチャットを開けます。",
  );
  assert.equal(
    teamChatOpenErrorMessage({ message: "not authenticated" }),
    "ログインが必要です。",
  );
  assert.equal(
    teamChatOpenErrorMessage(new Error("could not add chat member")),
    "しばらくしてから、もう一度お試しください。",
  );
});

test("the team chat page opens through the member-checked function", () => {
  assert.match(teamChatPage, /get_or_create_team_chat_thread/);
  assert.match(teamChatPage, /p_team_id:\s*teamId/);
  assert.match(teamChatPage, /teamChatOpenErrorMessage/);
  assert.equal(teamChatPage.includes("e?.message"), false);
  assert.equal(teamChatPage.includes("e.message"), false);
  assert.equal(/from\("chat_threads"\)/.test(teamChatPage), false);
  assert.equal(teamChatPage.includes("team_a_id"), false);
});

test("the chat list still attaches team chats by team_id", () => {
  assert.match(chatListPage, /isTeamThread && t\.team_id/);
  assert.match(chatListPage, /internalThreadByTeamId\.set\(t\.team_id/);
  assert.match(
    chatListPage,
    /\/chat\/\$\{team\.threadId\}\?from=team-message&teamId=\$\{team\.id\}/,
  );
});

test("the team chat migration is additive and qualifies thread team ids", () => {
  assert.equal(/drop\s+table/i.test(migration), false);
  assert.equal(/truncate/i.test(migration), false);
  assert.equal(/delete\s+from/i.test(migration), false);
  assert.equal(/update\s+public\.teams\b/i.test(migration), false);
  assert.equal(/drop\s+policy[\s\S]{0,120}chat_members/i.test(migration), false);
  assert.equal(/create\s+policy[\s\S]{0,160}chat_members/i.test(migration), false);
  assert.equal(migration.includes("tm.team_id = tm.team_id"), false);
  assert.equal(/tm\.team_id\s*=\s*team_id\b/.test(migration), false);

  assert.match(migration, /set team_id = team_a_id/);
  assert.match(migration, /thread_type = 'team'/);
  assert.match(migration, /team_id is null/);
  assert.match(migration, /t\.team_id = p_team_id or t\.team_a_id = p_team_id/);
  assert.match(migration, /'team',\s*p_team_id,\s*null,\s*p_team_id,/);
  assert.match(migration, /not a member of team/);
  assert.match(migration, /on conflict do nothing/);
  assert.match(migration, /grant execute on function public\.get_or_create_team_chat_thread\(uuid\) to authenticated/);
  assert.match(migration, /revoke all on function public\.get_or_create_team_chat_thread\(uuid\) from public, anon/);

  assert.match(migration, /t\.id = chat_threads\.team_a_id/);
  assert.match(migration, /t\.id = chat_threads\.team_b_id/);
  assert.match(migration, /t\.id = chat_threads\.team_id/);
  assert.match(migration, /tm\.team_id = chat_threads\.team_a_id/);
  assert.match(migration, /tm\.team_id = chat_threads\.team_b_id/);
  assert.match(migration, /tm\.team_id = chat_threads\.team_id/);

  assert.match(migration, /drop index if exists public\.chat_members_thread_team_uidx/);
  assert.match(migration, /drop index if exists public\.chat_members_thread_team_unique/);
  assert.match(migration, /chat_threads_team_chat_team_id_uidx/);
  assert.match(migration, /chat_threads_team_chat_team_a_id_uidx/);
});
