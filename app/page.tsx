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

      {!teamLoading && !hasTeam ? (
        <section style={ctaBox}>
          <div style={ctaTitle}>まずはチーム登録から始めましょう</div>
          <div style={ctaText}>
            チームを登録すると、試合の募集・申込・チャットが使えるようになります。
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

      <HomeCalendar />

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
              <div style={guideStep}>2. ホームで探す / 募集する</div>
              <div style={guideText}>
                ホームのカレンダーと絞り込みから、そのまま相手を探したり募集を出したりできます。
              </div>
            </div>

            <div style={guideBlock}>
              <div style={guideStep}>3. チャットで調整する</div>
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
                A. まずはチーム登録です。登録情報があると申込や募集ができます。
              </div>
            </div>

            <div style={qaItem}>
              <div style={qaQ}>Q. 相手チームにすぐ連絡できますか？</div>
              <div style={qaA}>
                A. はい。募集詳細からそのままチャットに進めます。
              </div>
            </div>

            <div style={qaItem}>
              <div style={qaQ}>Q. 試合を探すのはどこですか？</div>
              <div style={qaA}>
                A. ホームのカレンダーと絞り込みから、そのまま探せます。
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