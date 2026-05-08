"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";

type InviteRow = {
  id: string;
  team_id: string;
  code: string;
  role: "coach" | "member";
  display_name: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export default function TeamJoinPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>読み込み中…</div>}>
      <TeamJoinPageInner />
    </Suspense>
  );
}

function TeamJoinPageInner() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";

  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const searchParams = useSearchParams();

  useEffect(() => {
    const qCode = searchParams.get("code");

    if (qCode) {
      setCode(normalizeCode(qCode));
    }
  }, [searchParams]);

  const joinTeam = async () => {
    const normalizedCode = normalizeCode(code);
    const name = displayName.trim();

    setErrorText("");
    setSuccessText("");

    if (!userId) {
      setErrorText("ログイン後に参加できます。");
      return;
    }

    if (!normalizedCode) {
      setErrorText("招待コードを入力してください。");
      return;
    }

    setSaving(true);

    try {
      const { data: inviteRaw, error: inviteError } = await supabase
        .from("team_invites")
        .select(
          "id,team_id,code,role,display_name,expires_at,max_uses,used_count,is_active"
        )
        .eq("code", normalizedCode)
        .maybeSingle();

      if (inviteError) throw inviteError;

      if (!inviteRaw) {
        setErrorText("招待コードが見つかりません。");
        return;
      }

      const invite = inviteRaw as InviteRow;

      if (!invite.is_active) {
        setErrorText("この招待コードは無効です。");
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
        setErrorText("この招待コードは有効期限切れです。");
        return;
      }

      if (
        typeof invite.max_uses === "number" &&
        invite.max_uses > 0 &&
        invite.used_count >= invite.max_uses
      ) {
        setErrorText("この招待コードは利用上限に達しています。");
        return;
      }

      const finalDisplayName = name || invite.display_name || null;

      const { error: upsertError } = await supabase.from("team_members").upsert(
        {
          team_id: invite.team_id,
          user_id: userId,
          role: invite.role,
          display_name: finalDisplayName,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "team_id,user_id",
        }
      );

      if (upsertError) throw upsertError;

      const { error: updateInviteError } = await supabase
        .from("team_invites")
        .update({
          used_count: invite.used_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (updateInviteError) throw updateInviteError;

      setSuccessText("チームに参加しました。マイページからチーム詳細を確認できます。");
      setCode("");
      setDisplayName("");
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "チーム参加に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="🤝"
        title="チームに参加"
        desc="管理者から共有された招待コードを入力して、チームメンバーとして参加できます。"
      />

      <div style={topNavWrap}>
        <Link href="/teams" className="sh-btn">
        戻る
        </Link>
      </div>

      {authLoading ? (
        <div style={emptyBox}>読み込み中…</div>
      ) : !userId ? (
        <div style={emptyBox}>ログイン後に利用できます。</div>
      ) : (
        <section style={card}>
          <div style={sectionTitle}>招待コード入力</div>

          <label style={fieldLabel}>
            招待コード
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="例：ABC123"
              style={input}
              autoCapitalize="characters"
            />
          </label>

          <label style={fieldLabel}>
            表示名
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例：山田 太郎 / 山田母"
              style={input}
            />
          </label>

          {errorText ? <div style={errorBox}>{errorText}</div> : null}
          {successText ? <div style={successBox}>{successText}</div> : null}

          {successText ? (
            <Link href="/mypage" className="sh-btn sh-btn--primary">
              マイページへ
            </Link>
          ) : null}

          {!successText ? (
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={joinTeam}
              disabled={saving}
            >
              {saving ? "参加中…" : "チームに参加する"}
            </button>
          ) : null}
        </section>
      )}
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: 16,
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  textAlign: "center",
};

const card: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#fff",
  display: "grid",
  gap: 12,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 5,
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 11px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 14,
};

const errorBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  lineHeight: 1.6,
};

const successBox: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid #bbf7d0",
  background: "#f0fdf4",
  color: "#166534",
  lineHeight: 1.6,
};

const topNavWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};