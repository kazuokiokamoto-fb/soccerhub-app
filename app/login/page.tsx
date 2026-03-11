"use client";

import React, { useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [message, setMessage] = useState("");

  const handleGoogleLogin = async () => {
    setMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/`
            : undefined,
      },
    });

    if (error) {
      setMessage(`Googleログインに失敗しました: ${error.message}`);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoadingLogin(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoadingLogin(false);

    if (error) {
      setMessage(`ログインに失敗しました: ${error.message}`);
      return;
    }

    window.location.href = "/";
  };

  const handleSignup = async () => {
    if (!email || !password) {
      setMessage("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoadingSignup(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoadingSignup(false);

    if (error) {
      setMessage(`新規登録に失敗しました: ${error.message}`);
      return;
    }

    setMessage("新規登録を受け付けました。確認メールをチェックしてください。");
  };

  return (
    <main style={pageWrap}>
      <section style={heroBox}>
        <h1 style={heroTitle}>⚽ ログイン / 登録</h1>
        <p style={heroDesc}>
          チーム登録、練習試合の募集、対戦相手検索、チャット機能を使うにはログインしてください。
        </p>
      </section>

      <section style={card}>
        <div style={brandRow}>
          <div style={brandMark}>⚽</div>
          <div>
            <div style={brandTitle}>サカまち</div>
            <div style={brandSub}>Soccer Match Hub</div>
          </div>
        </div>

        <h2 style={title}>ログイン / 登録</h2>
        <p style={desc}>
          チーム登録や練習試合マッチングを始めるにはログインしてください。
        </p>

        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="sh-btn"
            style={topButton}
            onClick={handleGoogleLogin}
          >
            Googleでログイン
          </button>
        </div>

        <div style={divider}>またはメールで続ける</div>

        <div style={formGrid}>
          <label style={label}>
            <span style={labelTitle}>メールアドレス</span>
            <input
              type="email"
              className="sh-input"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label style={label}>
            <span style={labelTitle}>パスワード</span>
            <input
              type="password"
              className="sh-input"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        </div>

        <div style={buttonRow}>
          <button
            type="button"
            className="sh-btn"
            style={subButton}
            onClick={handleSignup}
            disabled={loadingSignup || loadingLogin}
          >
            {loadingSignup ? "新規登録中..." : "新規登録"}
          </button>

          <button
            type="button"
            className="sh-btn sh-btn--primary"
            style={mainButton}
            onClick={handleLogin}
            disabled={loadingLogin || loadingSignup}
          >
            {loadingLogin ? "ログイン中..." : "ログイン"}
          </button>
        </div>

        {message ? (
          <div
            style={{
              ...messageBox,
              ...(message.includes("失敗") ? messageError : messageInfo),
            }}
          >
            {message}
          </div>
        ) : null}

        <div style={guideBox}>
          <div style={guideTitle}>はじめて使う方へ</div>
          <div style={guideText}>
            まずはログイン後にチーム登録をすると、練習試合の募集や申込みができるようになります。
          </div>

          <div style={{ marginTop: 12 }}>
            <Link href="/" className="sh-btn">
              トップへ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 18,
  boxShadow: "0 10px 28px rgba(20,92,42,0.16)",
  marginTop: 12,
  marginBottom: 16,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.3,
};

const heroDesc: React.CSSProperties = {
  margin: "10px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.8,
  fontSize: 14,
};

const card: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 24,
  background: "#fff",
  padding: 24,
  boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
};

const brandRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 20,
};

const brandMark: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  fontSize: 34,
  color: "#fff",
  background: "linear-gradient(180deg, #1f8f43, #14652f)",
  boxShadow: "0 8px 18px rgba(20, 92, 42, 0.18)",
};

const brandTitle: React.CSSProperties = {
  fontFamily: '"Zen Kaku Gothic New", sans-serif',
  fontWeight: 900,
  fontSize: 32,
  letterSpacing: "0.08em",
  transform: "skewX(-8deg)",
  color: "#145c2a",
};

const brandSub: React.CSSProperties = {
  fontSize: 12,
  color: "#7a8a80",
  letterSpacing: "0.05em",
  marginTop: 4,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  color: "#14213d",
};

const desc: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#666",
  fontSize: 14,
  lineHeight: 1.9,
};

const topButton: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  fontSize: 18,
  fontWeight: 900,
};

const divider: React.CSSProperties = {
  textAlign: "center",
  color: "#8a8a8a",
  fontSize: 14,
  margin: "22px 0 18px",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#1c2b22",
};

const buttonRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginTop: 22,
};

const subButton: React.CSSProperties = {
  minHeight: 56,
  fontSize: 18,
  fontWeight: 900,
};

const mainButton: React.CSSProperties = {
  minHeight: 56,
  fontSize: 18,
  fontWeight: 900,
};

const messageBox: React.CSSProperties = {
  marginTop: 18,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #eee",
  fontSize: 14,
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};

const messageInfo: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
  color: "#1e3a8a",
};

const messageError: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
};

const guideBox: React.CSSProperties = {
  marginTop: 22,
  padding: 16,
  border: "1px solid #dbe7df",
  borderRadius: 18,
  background: "#f7fbf8",
};

const guideTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#1f5d30",
};

const guideText: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  lineHeight: 1.8,
  color: "#44554b",
};