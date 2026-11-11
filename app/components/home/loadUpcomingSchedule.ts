import { categoryLabel } from "@/app/lib/categories";
import { supabase } from "@/app/lib/supabase";
import { ymdToday } from "@/app/match/utils/date";

export type UpcomingScheduleItem = {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  areaText: string;
  categoryText: string;
  role: "host" | "guest";
};

type SlotRow = {
  id: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  area: string | null;
  area_text: string | null;
  category: string | null;
};

function toItem(slot: SlotRow, role: "host" | "guest"): UpcomingScheduleItem {
  return {
    slotId: slot.id,
    date: String(slot.date ?? ""),
    startTime: String(slot.start_time ?? ""),
    endTime: String(slot.end_time ?? ""),
    areaText: String(slot.area_text ?? slot.area ?? "未設定"),
    categoryText: String(categoryLabel(slot.category) || slot.category || "未設定"),
    role,
  };
}

/** Accepted matches for the signed-in user's teams, soonest first. */
export async function loadUpcomingSchedule(
  teamIds: readonly string[],
): Promise<UpcomingScheduleItem[]> {
  if (teamIds.length === 0) return [];

  const today = ymdToday();
  const { data: hostedSlotsRaw, error: hostedSlotsError } = await supabase
    .from("match_slots")
    .select("id, date, start_time, end_time, area, area_text, category, host_team_id")
    .in("host_team_id", [...teamIds])
    .gte("date", today)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(50);

  if (hostedSlotsError) throw hostedSlotsError;

  const hostedSlots = (hostedSlotsRaw ?? []) as SlotRow[];
  const hostedSlotIds = hostedSlots.map((slot) => slot.id);
  let hostedAcceptedSlotIds: string[] = [];

  if (hostedSlotIds.length > 0) {
    const { data, error } = await supabase
      .from("match_requests")
      .select("slot_id")
      .in("slot_id", hostedSlotIds)
      .eq("status", "accepted");
    if (error) throw error;
    hostedAcceptedSlotIds = [
      ...new Set(
        ((data ?? []) as Array<{ slot_id: string }>).map((row) => row.slot_id),
      ),
    ];
  }

  const { data: requesterAcceptedRaw, error: requesterAcceptedError } = await supabase
    .from("match_requests")
    .select("slot_id, requester_team_id")
    .in("requester_team_id", [...teamIds])
    .eq("status", "accepted");
  if (requesterAcceptedError) throw requesterAcceptedError;

  const requesterAccepted = (requesterAcceptedRaw ?? []) as Array<{ slot_id: string }>;
  const requesterSlotIds = [
    ...new Set(requesterAccepted.map((row) => row.slot_id)),
  ].filter((id) => !hostedSlotIds.includes(id));

  let requesterSlots: SlotRow[] = [];
  if (requesterSlotIds.length > 0) {
    const { data, error } = await supabase
      .from("match_slots")
      .select("id, date, start_time, end_time, area, area_text, category, host_team_id")
      .in("id", requesterSlotIds)
      .gte("date", today)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    requesterSlots = (data ?? []) as SlotRow[];
  }

  const merged = [
    ...hostedSlots
      .filter((slot) => hostedAcceptedSlotIds.includes(slot.id))
      .map((slot) => toItem(slot, "host")),
    ...requesterSlots.map((slot) => toItem(slot, "guest")),
  ]
    .filter((item) => item.date)
    .sort((a, b) =>
      `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
    );

  const seen = new Set<string>();
  const deduped: UpcomingScheduleItem[] = [];
  for (const item of merged) {
    if (seen.has(item.slotId)) continue;
    seen.add(item.slotId);
    deduped.push(item);
  }
  return deduped;
}
