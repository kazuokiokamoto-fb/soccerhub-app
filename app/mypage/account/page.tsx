"use client";

import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type ProfileRow = {
  user_id: string;
  name: string | null;
  phone: string | null;
  line_id: string | null;
  notify_email: boolean | null;
  notify_line: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Toast = {
  type: "success" | "error" | "info";
  text: string;
};

export default function AccountEditPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [meId, setMeId] = useState("");
  const [email, setEmail] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyLine, setNotifyLine] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    load();
  }, []);

  const canSave = useMemo(() => {
    return !!meId && !saving;
  }, [meId, saving]);

  async function load() {
    setLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setToast({ type: "error", text: "ログインが必要です" });
        setLoading(false);
        return;
      }

      setMeId(user.id);
      setEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,name,phone,line_id,notify_email,notify_line,created_at,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        setToast({ type: "error", text: `プロフィール読込に失敗しました: ${error.message}` });
        setLoading(false);
        return;
      }

      const p = (data ?? null) as ProfileRow | null;

      setName(p?.name ?? "");
      setPhone(p?.phone ?? "");
      setLineId(p?.line_id ?? "");
      setNotifyEmail(p?.notify_email ?? true);
      setNotifyLine(p?.notify_line ?? false);
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "読込に失敗しました" });
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!meId) {
      setToast({ type: "error", text: "ログインが必要です" });
      return;
    }

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    try {
      const payload = {
        user_id: meId,
        name: name.trim() || null,
        phone: phone.trim() || null,
        line_id: lineId.trim() || null,
        notify_email: notifyEmail,
        notify_line: notifyLine,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert(payload, {
        onConflict: "user_id",
      });

      if (error) {
        console.error(error);
        setToast({ type: "error", text: `保存に失敗しました: ${error.message}` });
        setSaving(false);
        return;
      }

      setToast({ type: "success", text: "✅ アカウント情報を更新しました" });
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: e?.message ?? "保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>読み込み中…</main>;
  }

  return (
    <main style={wrap}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
              ? toastError
              : toastInfo),
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{toast.text}</div>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={toastClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      ) : null}

      <AppHero
        icon="👤"
        title="アカウント設定"
        desc="代表者情報と通知設定を編集できます。"
      />

      <section style={card}>
        <div style={{ display: "grid", gap: 14 }}>
          <label style={label}>
            <span style={labelTitle}>メールアドレス</span>
            <input value={email} className="sh-input" disabled />
            <span style={helperText}>
              ※ メールアドレス自体の変更は認証設定側で行います。
            </span>
          </label>

          <label style={label}>
            <span style={labelTitle}>代表者氏名</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sh-input"
              placeholder="例：岡本 一樹"
              disabled={saving}
            />
          </label>

          <label style={label}>
            <span style={labelTitle}>電話番号</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="sh-input"
              placeholder="例：09012345678"
              disabled={saving}
            />
          </label>

          <label style={label}>
            <span style={labelTitle}>LINE ID</span>
            <input
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className="sh-input"
              placeholder="例：soccer_match_kanto"
              disabled={saving}
            />
          </label>

          <div style={notifyBox}>
            <div style={notifyTitle}>通知設定</div>

            <label style={checkRow}>
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                disabled={saving}
              />
              メール通知を受け取る
            </label>

            <label style={checkRow}>
              <input
                type="checkbox"
                checked={notifyLine}
                onChange={(e) => setNotifyLine(e.target.checked)}
                disabled={saving}
              />
              LINE通知を受け取る
            </label>

            <div style={helperText}>
              ※ 現在この設定画面では保存まで対応しています。<br />
              ※ 実際の外部送信（メール自動送信 / LINE自動送信）は別途連携実装が必要です。<br />
              ※ アプリ内の未読表示は、すでにチャット一覧などで動かせます。
            </div>
          </div>

          <div style={actionRow}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={save}
              disabled={!canSave}
            >
              {saving ? "保存中…" : "保存"}
            </button>

            <Link href="/mypage" className="sh-btn">
              マイページへ戻る
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const card: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #e5ece7",
  borderRadius: 20,
  background: "#fff",
  padding: 18,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const helperText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
  lineHeight: 1.7,
};

const notifyBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 14,
  display: "grid",
  gap: 10,
};

const notifyTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const checkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontWeight: 700,
  color: "#21342a",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const toastBox: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 12,
};

const toastSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
  color: "#166534",
};

const toastError: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
  color: "#1e3a8a",
};

const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};