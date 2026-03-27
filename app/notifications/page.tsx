"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";
import AppHero from "@/app/components/AppHero";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  target_url: string;
  is_read: boolean;
  related_team_id: string | null;
  related_thread_id: string | null;
  related_offer_id: string | null;
  related_request_id: string | null;
  created_at: string;
};

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString("ja-JP");
  } catch {
    return dt;
  }
}

export default function NotificationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [meId, setMeId] = useState("");
  const [openingId, setOpeningId] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) {
      setLoading(false);
      return;
    }

    loadNotifications();

    const channel = supabase
      .channel(`notifications-page:${meId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId]);

  async function loadNotifications() {
    setLoading(true);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data ?? []) as NotificationRow[]);
    setLoading(false);
  }

  const unreadCount = useMemo(() => {
    return items.filter((x) => !x.is_read).length;
  }, [items]);

  async function openNotification(item: NotificationRow) {
    if (openingId) return;

    setOpeningId(item.id);

    try {
      if (!item.is_read) {
        const res = await fetch("/api/notifications/read", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: item.id }),
        });

        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? "既読更新に失敗しました");
        }

        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id ? { ...x, is_read: true } : x
          )
        );
      }

      router.push(item.target_url || "/");
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "通知の処理に失敗しました");
      setOpeningId("");
    }
  }

  async function markAllRead() {
    if (!meId) return;

    const res = await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: meId }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      alert(json?.error ?? "一括既読に失敗しました");
      return;
    }

    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
  }

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <AppTabNav />

      <AppHero
        icon="🔔"
        title="通知一覧"
        desc="チャット、オファー、承認などの通知を確認できます。"
      />

      {/* 🔥 一括既読付きヘッダー */}
      <div style={summaryBox}>
        <div style={summaryHeaderRow}>
          <div>
            <div style={summaryTitle}>通知</div>
            <div style={summaryText}>
              {loading
                ? "読み込み中…"
                : `全${items.length}件 / 未読${unreadCount}件`}
            </div>
          </div>

          {!loading && unreadCount > 0 && (
            <button
              className="sh-btn"
              onClick={markAllRead}
            >
              すべて既読
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={emptyBox}>読み込み中…</div>
      ) : items.length === 0 ? (
        <div style={emptyBox}>通知はまだありません。</div>
      ) : (
        <div style={listWrap}>
          {items.map((item) => {
            const busy = openingId === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openNotification(item)}
                disabled={busy}
                style={{
                  ...card,
                  ...(item.is_read ? cardRead : cardUnread),
                  ...(busy ? cardBusy : null),
                }}
              >
                <div style={topRow}>
                  <div style={title}>{item.title}</div>
                  {!item.is_read && (
                    <span style={unreadBadge}>未読</span>
                  )}
                </div>

                <div style={body}>{item.body}</div>

                <div style={metaRow}>
                  <span style={typePill}>{item.type}</span>
                  <span style={timeText}>
                    {busy ? "移動中…" : fmt(item.created_at)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}

/* ================= styles ================= */

const summaryBox: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const summaryHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const summaryTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#1f5d30",
};

const summaryText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#66756d",
};

const listWrap: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 8,
};

const card: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 16,
  color: "#111",
  border: "1px solid #e5ece7",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  background: "#fff",
};

const cardUnread: React.CSSProperties = {
  background: "#f7fff9",
};

const cardRead: React.CSSProperties = {
  background: "#fff",
};

const cardBusy: React.CSSProperties = {
  opacity: 0.75,
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
};

const title: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
};

const body: React.CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
};

const metaRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
};

const typePill: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 999,
  background: "#e8f5eb",
};

const timeText: React.CSSProperties = {
  fontSize: 12,
};

const unreadBadge: React.CSSProperties = {
  background: "#dcfce7",
  padding: "4px 10px",
  borderRadius: 999,
};

const emptyBox: React.CSSProperties = {
  marginTop: 12,
  padding: 20,
  textAlign: "center",
};