"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";
import HomeCalendar from "@/app/components/home/HomeCalendar";

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  category: string | null;
};

export default function HomePage() {
  const [meId, setMeId] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [myTeams, setMyTeams] = useState<TeamRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  const [showGuide, setShowGuide] = useState(false);
  const [showQa, setShowQa] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setMeId(session?.user?.id ?? "");
      } catch (e) {
        console.error("getSession error:", e);
        if (!mounted) return;
        setMeId("");
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setMeId(session?.user?.id ?? "");
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadTeams = async () => {
      if (authLoading) return;

      if (!meId) {
        if (!mounted) return;
        setMyTeams([]);
        setTeamLoading(false);
        return;
      }

      setTeamLoading(true);

      try {
        const { data, error } = await supabase
          .from("teams")
          .select("id, owner_id, name, category")
          .eq("owner_id", meId);

        if (error) {
          console.error("load teams error:", error);
          if (!mounted) return;
          setMyTeams([]);
          setTeamLoading(false);
          return;
        }

        if (!mounted) return;
        setMyTeams((data ?? []) as TeamRow[]);
      } catch (e) {
        console.error("load teams catch:", e);
        if (!mounted) return;
        setMyTeams([]);
      } finally {
        if (mounted) {
          setTeamLoading(false);
        }
      }
    };

    loadTeams();

    return () => {
      mounted = false;
    };
  }, [authLoading, meId]);

  const hasTeam = useMemo(() => myTeams.length > 0, [myTeams.length]);

  if (authLoading) {
    return (
      <main style={wrap}>
        <AppTabNav />
        <div style={loadingPanel}>ログイン状態を確認中…</div>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <AppTabNav />

      <HomeCalendar />

      <section style={searchHero}>
        <div style={searchHeroTextWrap}>
          <div style={searchEyebrow}>SOCCER MATCHING</div>
          <h1 style={searchHeroTitle}>相手を探す。募集する。すぐ話す。</h1>
          <p style={searchHeroDesc}>
            サカまちは、LINEのように連絡しやすく、
            SUUMOのように探しやすいサッカー練習試合マッチングです。
          </p>
        </div>

        <div style={searchHeroActions}>
          <Link href="/match" className="sh-btn sh-btn--primary">
            試合を探す
          </Link>
          <Link href="/teams/search" className="sh-btn">
            チーム検索
          </Link>
          <Link href="/match/new" className="sh-btn">
            募集する
          </Link>
        </div>
      </section>

      <section style={quickGrid}>
        <Link href="/teams/search" style={quickCardLink}>
          <div style={quickCard}>
            <div style={quickTitle}>🔎 SUUMOみたいに探す</div>
            <div style={quickText}>
              エリア、カテゴリ、強さ、人数感などから相手チームを探せます。
            </div>
          </div>
        </Link>

        <Link href="/match" style={quickCardLink}>
          <div style={quickCard}>
            <div style={quickTitle}>📅 カレンダーから探す</div>
            <div style={quickText}>
              日付ごとの募集件数を見ながら、そのまま試合相手を探せます。
            </div>
          </div>
        </Link>

        <Link href="/chat" style={quickCardLink}>
          <div style={quickCard}>
            <div style={quickTitle}>💬 LINEみたいに連絡</div>
            <div style={quickText}>
              申込後はそのままチャットで日程や詳細をすぐ調整できます。
            </div>
          </div>
        </Link>
      </section>

      {!teamLoading && !hasTeam ? (
        <section style={ctaBox}>
          <div style={ctaTitle}>まずはチーム登録から始めましょう</div>
          <div style={ctaText}>
            チームを登録すると、試合の募集・申込・招待・チャットが使えるようになります。
          </div>
          <div style={ctaActions}>
            <Link href="/teams/new" className="sh-btn sh-btn--primary">
              チームを登録する
            </Link>
            <Link href="/mypage" className="sh-btn">
              マイページへ
            </Link>
          </div>
        </section>
      ) : null}

      <section style={foldSection}>
        <button
          type="button"
          style={foldButton}
          onClick={() => setShowGuide((v) => !v)}
        >
          <span>使い方</span>
          <span>{showGuide ? "−" : "+"}</span>
        </button>

        {showGuide ? (
          <div style={foldBody}>
            <div style={guideBlock}>
              <div style={guideStep}>1. チームを登録する</div>
              <div style={guideText}>
                まずはチーム名、エリア、カテゴリ、強さ、グラウンド提供可否、人数などを登録します。
              </div>
            </div>

            <div style={guideBlock}>
              <div style={guideStep}>2. 試合を探す / 募集する</div>
              <div style={guideText}>
                カレンダーや検索から相手を探したり、自分で募集を出したりできます。
              </div>
            </div>

            <div style={guideBlock}>
              <div style={guideStep}>3. チャットで連絡する</div>
              <div style={guideText}>
                申込後はそのままチャットに進み、日程や詳細を調整できます。
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section style={foldSection}>
        <button
          type="button"
          style={foldButton}
          onClick={() => setShowQa((v) => !v)}
        >
          <span>Q&amp;A</span>
          <span>{showQa ? "−" : "+"}</span>
        </button>

        {showQa ? (
          <div style={foldBody}>
            <div style={qaItem}>
              <div style={qaQ}>Q. まず何をすればいいですか？</div>
              <div style={qaA}>
                A. まずはチーム登録です。登録情報があると検索にも募集にも進みやすくなります。
              </div>
            </div>

            <div style={qaItem}>
              <div style={qaQ}>Q. 相手チームにすぐ連絡できますか？</div>
              <div style={qaA}>
                A. はい。募集詳細からそのままチャットに進めます。
              </div>
            </div>

            <div style={qaItem}>
              <div style={qaQ}>Q. 募集するだけでなく探すこともできますか？</div>
              <div style={qaA}>
                A. できます。カレンダーと検索の両方から探せます。
              </div>
            </div>

            <div style={qaItem}>
              <div style={qaQ}>Q. お問い合わせはどこですか？</div>
              <div style={qaA}>
                A. 下のメールアドレスからご連絡ください。
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section style={contactBox}>
        <div style={contactTitle}>お問い合わせ</div>
        <div style={contactText}>
          ご不明点・改善要望・掲載相談はこちらへご連絡ください。
        </div>
        <a href="mailto:info@sakamatch.com" style={mailLink}>
          info@sakamatch.com
        </a>
      </section>
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const loadingPanel: React.CSSProperties = {
  marginTop: 16,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  textAlign: "center",
};

const searchHero: React.CSSProperties = {
  marginTop: 16,
  borderRadius: 18,
  background: "linear-gradient(135deg,#1e7f3c,#145c2a)",
  color: "#fff",
  padding: 18,
  display: "grid",
  gap: 14,
};

const searchHeroTextWrap: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const searchEyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.8)",
};

const searchHeroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.3,
  fontWeight: 900,
};

const searchHeroDesc: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.8,
  color: "rgba(255,255,255,0.92)",
};

const searchHeroActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const quickGrid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
};

const quickCardLink: React.CSSProperties = {
  textDecoration: "none",
};

const quickCard: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const quickTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#16391f",
};

const quickText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.7,
};

const ctaBox: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#f5fbf6",
};

const ctaTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#16391f",
};

const ctaText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#444",
  lineHeight: 1.7,
};

const ctaActions: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const foldSection: React.CSSProperties = {
  marginTop: 20,
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  overflow: "hidden",
};

const foldButton: React.CSSProperties = {
  width: "100%",
  padding: "16px 18px",
  border: "none",
  background: "#fff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  cursor: "pointer",
};

const foldBody: React.CSSProperties = {
  padding: "0 18px 18px",
  display: "grid",
  gap: 10,
};

const guideBlock: React.CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #f0f0f0",
};

const guideStep: React.CSSProperties = {
  fontWeight: 800,
  color: "#145c2a",
  marginBottom: 6,
};

const guideText: React.CSSProperties = {
  fontSize: 14,
  color: "#444",
  lineHeight: 1.8,
};

const qaItem: React.CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #f0f0f0",
};

const qaQ: React.CSSProperties = {
  fontWeight: 800,
  color: "#145c2a",
  marginBottom: 4,
};

const qaA: React.CSSProperties = {
  fontSize: 14,
  color: "#444",
  lineHeight: 1.8,
};

const contactBox: React.CSSProperties = {
  marginTop: 20,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const contactTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
};

const contactText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.7,
};

const mailLink: React.CSSProperties = {
  display: "inline-block",
  marginTop: 10,
  color: "#145c2a",
  fontWeight: 900,
  textDecoration: "none",
};