import type { SupabaseClient } from "@supabase/supabase-js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}

type AdminClient = SupabaseClient;

async function teamIdsForUser(admin: AdminClient, userId: string) {
  const [owned, member] = await Promise.all([
    admin.from("teams").select("id").eq("owner_id", userId),
    admin.from("team_members").select("team_id").eq("user_id", userId),
  ]);

  if (owned.error) throw owned.error;
  if (member.error) throw member.error;

  const ids = new Set<string>();
  for (const row of owned.data ?? []) {
    if (typeof row.id === "string") ids.add(row.id);
  }
  for (const row of member.data ?? []) {
    if (typeof row.team_id === "string") ids.add(row.team_id);
  }
  return [...ids];
}

async function sharesChatThread(
  admin: AdminClient,
  callerId: string,
  targetUserId: string,
) {
  const { data, error } = await admin
    .from("chat_members")
    .select("thread_id")
    .eq("user_id", callerId);

  if (error) throw error;

  const threadIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.thread_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
  if (threadIds.length === 0) return false;

  const { count, error: countError } = await admin
    .from("chat_members")
    .select("thread_id", { count: "exact", head: true })
    .eq("user_id", targetUserId)
    .in("thread_id", threadIds);

  if (countError) throw countError;
  return (count ?? 0) > 0;
}

async function slotIdsForUser(
  admin: AdminClient,
  userId: string,
  teamIds: string[],
) {
  const ids = new Set<string>();

  const owned = await admin
    .from("match_slots")
    .select("id")
    .eq("owner_id", userId)
    .limit(500);
  if (owned.error) throw owned.error;
  for (const row of owned.data ?? []) {
    if (typeof row.id === "string") ids.add(row.id);
  }

  if (teamIds.length > 0) {
    const hosted = await admin
      .from("match_slots")
      .select("id")
      .in("host_team_id", teamIds)
      .limit(500);
    if (hosted.error) throw hosted.error;
    for (const row of hosted.data ?? []) {
      if (typeof row.id === "string") ids.add(row.id);
    }
  }

  return [...ids];
}

async function hasMatchRelationship(
  admin: AdminClient,
  callerId: string,
  targetUserId: string,
  callerTeams: string[],
  targetTeams: string[],
) {
  if (callerTeams.length > 0 && targetTeams.length > 0) {
    const sent = await admin
      .from("match_offers")
      .select("id", { count: "exact", head: true })
      .in("from_team_id", callerTeams)
      .in("to_team_id", targetTeams);
    if (sent.error) throw sent.error;
    if ((sent.count ?? 0) > 0) return true;

    const received = await admin
      .from("match_offers")
      .select("id", { count: "exact", head: true })
      .in("from_team_id", targetTeams)
      .in("to_team_id", callerTeams);
    if (received.error) throw received.error;
    if ((received.count ?? 0) > 0) return true;
  }

  const [targetSlots, callerSlots] = await Promise.all([
    slotIdsForUser(admin, targetUserId, targetTeams),
    slotIdsForUser(admin, callerId, callerTeams),
  ]);

  if (targetSlots.length > 0) {
    const requested = await admin
      .from("match_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_user_id", callerId)
      .in("slot_id", targetSlots);
    if (requested.error) throw requested.error;
    if ((requested.count ?? 0) > 0) return true;
  }

  if (callerSlots.length > 0) {
    const incoming = await admin
      .from("match_requests")
      .select("id", { count: "exact", head: true })
      .eq("requester_user_id", targetUserId)
      .in("slot_id", callerSlots);
    if (incoming.error) throw incoming.error;
    if ((incoming.count ?? 0) > 0) return true;
  }

  return false;
}

/** Browser callers may notify a user they already share a chat or match with. */
export async function callerMayNotify(
  admin: AdminClient,
  callerId: string,
  targetUserId: string,
) {
  if (callerId === targetUserId) return false;
  if (await sharesChatThread(admin, callerId, targetUserId)) return true;

  const [callerTeams, targetTeams] = await Promise.all([
    teamIdsForUser(admin, callerId),
    teamIdsForUser(admin, targetUserId),
  ]);

  return hasMatchRelationship(
    admin,
    callerId,
    targetUserId,
    callerTeams,
    targetTeams,
  );
}
