export type Msg = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_team_id: string | null;
  body: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by_sender?: boolean;
  deleted_for_everyone?: boolean;
};

export type TeamMini = {
  id: string;
  name: string | null;
  category?: string | null;
};

export type ChatMemberRow = {
  thread_id: string;
  user_id?: string | null;
  team_id?: string | null;
  last_read_at: string | null;
};

export type ChatQueryParams = {
  from?: string | null;
  slotId?: string | null;
  date?: string | null;
};

export type BackLink = {
  href: string;
  label: string;
};

export function nowIso() {
  return new Date().toISOString();
}

export function formatBubbleTime(dt?: string | null) {
  if (!dt) return "";

  try {
    const d = new Date(dt);
    return d.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function formatDateDivider(dt?: string | null) {
  if (!dt) return "";

  try {
    const d = new Date(dt);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return "";
  }
}

export function formatReadTime(dt?: string | null) {
  if (!dt) return "";

  try {
    const d = new Date(dt);
    return d.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function sameDate(a?: string | null, b?: string | null) {
  if (!a || !b) return false;

  const da = new Date(a);
  const db = new Date(b);

  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function buildQueryString(params: ChatQueryParams) {
  const qs = new URLSearchParams();

  if (params.from) qs.set("from", params.from);
  if (params.slotId) qs.set("slotId", params.slotId);
  if (params.date) qs.set("date", params.date);

  return qs.toString();
}

export function getBackLink(params: ChatQueryParams): BackLink {
  const { from, slotId, date } = params;

  switch (from) {
    case "home": {
      const qs = new URLSearchParams();
      if (date) qs.set("date", date);
      if (slotId) qs.set("slotId", slotId);

      return {
        href: qs.toString() ? `/?${qs.toString()}` : "/",
        label: "← ホームに戻る",
      };
    }

    case "match-calendar": {
      const qs = new URLSearchParams();
      if (date) qs.set("date", date);
      if (slotId) qs.set("slotId", slotId);

      return {
        href: qs.toString() ? `/match?${qs.toString()}` : "/match",
        label: "← 試合を探すに戻る",
      };
    }

    case "sent-offers":
      return {
        href: "/match/status/offers",
        label: "← 送ったオファーへ",
      };

    case "received-offers":
      return {
        href: "/match/status/offers-received",
        label: "← 届いたオファーへ",
      };

    case "chat-list":
      return {
        href: "/chat",
        label: "← 一覧",
      };

    default:
      return {
        href: "/chat",
        label: "← 一覧",
      };
  }
}

export function resolveMyTeamId(params: {
  meId: string;
  memberRows: ChatMemberRow[];
  ownedTeams: TeamMini[];
}) {
  const { meId, memberRows, ownedTeams } = params;

  const ownedTeamIds = new Set(ownedTeams.map((t) => t.id).filter(Boolean));

  const myOwnMemberRow = memberRows.find(
    (r) => r.user_id === meId && r.team_id && ownedTeamIds.has(r.team_id)
  );
  if (myOwnMemberRow?.team_id) {
    return myOwnMemberRow.team_id;
  }

  const matchedMemberTeamId = memberRows.find(
    (r) => r.team_id && ownedTeamIds.has(r.team_id)
  )?.team_id;
  if (matchedMemberTeamId) {
    return matchedMemberTeamId;
  }

  if (ownedTeams.length === 1) {
    return ownedTeams[0].id;
  }

  return ownedTeams[0]?.id ?? "";
}

export function isOptimisticMessageId(id?: string | null) {
  return String(id ?? "").startsWith("optimistic-");
}

export function isReadByOther(params: {
  messageCreatedAt?: string | null;
  otherLastReadAt?: string | null;
}) {
  const { messageCreatedAt, otherLastReadAt } = params;
  if (!messageCreatedAt || !otherLastReadAt) return false;

  try {
    return (
      new Date(otherLastReadAt).getTime() >=
      new Date(messageCreatedAt).getTime()
    );
  } catch {
    return false;
  }
}

export function isDeletedForEveryone(m: Msg) {
  return !!m.deleted_for_everyone || !!m.deleted_at;
}

export function isDeletedOnlyForSender(m: Msg) {
  return !!m.deleted_by_sender && !m.deleted_for_everyone;
}

export function shouldHideForMe(m: Msg, meId: string) {
  return m.sender_id === meId && isDeletedOnlyForSender(m);
}

// ================================
// 予定抽出系（追加）
// ================================

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

export function normalizeDateCandidate(raw: string): string | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${currentYear}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const dash = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dash) {
    const year = Number(dash[1]);
    const month = Number(dash[2]);
    const day = Number(dash[3]);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const jp = raw.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (jp) {
    const month = Number(jp[1]);
    const day = Number(jp[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${currentYear}-${pad2(month)}-${pad2(day)}`;
    }
  }

  return null;
}

export function normalizeTimeCandidate(raw: string): string | null {
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const hh = Number(m[1]);
  const mm = Number(m[2]);

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${pad2(hh)}:${pad2(mm)}:00`;
}

export function extractScheduleCandidatesFromMessages(
  rows: Msg[],
  meId: string
) {
  const targetRows = [...rows]
    .filter((m) => !shouldHideForMe(m, meId))
    .filter((m) => !isDeletedForEveryone(m))
    .filter((m) => (m.body ?? "").trim().length > 0)
    .slice()
    .reverse();

  const dateRegexes = [
    /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
    /\b\d{1,2}\/\d{1,2}\b/g,
    /\b\d{1,2}月\d{1,2}日\b/g,
  ];

  const timeRegex = /\b\d{1,2}:\d{2}\b/g;
  const venueRegexes = [
    /([^\n。、，,\s]{2,40}グラウンド)/,
    /([^\n。、，,\s]{2,40}公園)/,
    /([^\n。、，,\s]{2,40}運動場)/,
    /([^\n。、，,\s]{2,40}競技場)/,
    /([^\n。、，,\s]{2,40}コート)/,
  ];

  let foundDate: string | null = null;
  let foundStartTime: string | null = null;
  let foundEndTime: string | null = null;
  let foundVenueName: string | null = null;
  let sourceMessageId: string | null = null;
  let sourceText: string | null = null;

  for (const row of targetRows) {
    const body = row.body ?? "";
    if (!body.trim()) continue;

    if (!sourceMessageId) {
      sourceMessageId = row.id;
      sourceText = body;
    }

    if (!foundDate) {
      for (const regex of dateRegexes) {
        const matched = body.match(regex);
        if (matched?.length) {
          const normalized = normalizeDateCandidate(matched[0]);
          if (normalized) {
            foundDate = normalized;
            break;
          }
        }
      }
    }

    if (!foundStartTime || !foundEndTime) {
      const times = body.match(timeRegex) ?? [];
      const normalizedTimes = times
        .map((v) => normalizeTimeCandidate(v))
        .filter((v): v is string => !!v);

      if (!foundStartTime && normalizedTimes[0]) {
        foundStartTime = normalizedTimes[0];
      }
      if (!foundEndTime && normalizedTimes[1]) {
        foundEndTime = normalizedTimes[1];
      }
    }

    if (!foundVenueName) {
      for (const regex of venueRegexes) {
        const matched = body.match(regex);
        if (matched?.[1]) {
          foundVenueName = matched[1];
          break;
        }
      }
    }

    if (foundDate && foundStartTime && foundEndTime && foundVenueName) {
      break;
    }
  }

  return {
    sourceMessageId,
    sourceText,
    date: foundDate,
    startTime: foundStartTime,
    endTime: foundEndTime,
    venueName: foundVenueName,
  };
}