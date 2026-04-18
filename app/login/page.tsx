"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import AppHero from "@/app/components/AppHero";

function safeRedirectPath(value: string | null) {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}

function LoginPageInner() {
  const searchParams = useSearchParams();

  const redirectPath = useMemo(() => {
    return safeRedirectPath(searchParams.get("redirect"));
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const [message, setMessage] = useState("");

  const isLineInAppBrowser = useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent || "";
    return /Line\//i.test(ua) || /LIFF/i.test(ua);
  }, []);

  useEffect(() => {
    if (!isLineInAppBrowser) return;

    setMessage(
      [
        "LINE内ブラウザでは Googleログインがブロックされることがあります。",
        "右上メニューなどから Safari / Chrome で開いてからログインしてください。",
      ].join("\n")
    );
  }, [isLineInAppBrowser]);

  const buildAuthCallbackUrl = () => {
    if (typeof window === "undefined") return undefined;
    return `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
      redirectPath
    )}`;
  };

  const handleGoogleLogin = async () => {
    setMessage("");

    if (isLineInAppBrowser) {
      setMessage(
        [
          "LINE内ブラウザでは Googleログインができません。",
          "このページを Safari / Chrome で開き直してから、Googleでログインしてください。",
          "",
          "例：",
          "・LINE右上のメニューから『Safariで開く』",
          "・URLをコピーして Safari / Chrome に貼り付ける",
        ].join("\n")
      );
      return;
    }

    setLoadingGoogle(true);

    const redirectTo = buildAuthCallbackUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setLoadingGoogle(false);
      setMessage(`Googleログインに失敗しました: ${error.message}`);
      return;
    }

    if (!data?.url) {
      setLoadingGoogle(false);
      setMessage("GoogleログインURLの取得に失敗しました。");
      return;
    }

    window.location.assign(data.url);
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

    window.location.href = redirectPath;
  };

  const handleSignup = async () => {
    if (!email || !password) {
      setMessage("メールアドレスとパスワードを入力してください。");
      return;
    }

    setLoadingSignup(true);
    setMessage("");

    const emailRedirectTo = buildAuthCallbackUrl();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    setLoadingSignup(false);

    if (error) {
      setMessage(`新規登録に失敗しました: ${error.message}`);
      return;
    }

    setMessage(
      "新規登録を受け付けました。確認メールをチェックしてください。確認後は元のページに戻ります。"
    );
  };

  return (
    <main style={pageWrap}>
      <AppHero
        icon="🔐"
        title="ログイン / 登録"
        desc="チーム登録、練習試合の募集、対戦相手検索、チャット機能を使うにはログインしてください。"
      />

      <section style={card}>
        <div style={blockTitle}>Googleで続ける</div>

        {redirectPath !== "/" ? (
          <div style={redirectInfoBox}>
            ログイン後は <b>{redirectPath}</b> に戻ります。
          </div>
        ) : null}

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="sh-btn"
            style={topButton}
            onClick={handleGoogleLogin}
            disabled={loadingGoogle || loadingLogin || loadingSignup}
          >
            {loadingGoogle ? "Googleへ移動中..." : "Googleでログイン"}
          </button>
        </div>

        {isLineInAppBrowser ? (
          <div style={warnBox}>
            <div style={warnTitle}>LINE内ブラウザでは Googleログイン不可</div>
            <div style={warnText}>
              Google の仕様により、LINEアプリ内ブラウザではログインできない場合があります。
              <br />
              Safari / Chrome でこのページを開き直してからログインしてください。
            </div>
          </div>
        ) : null}

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
            disabled={loadingSignup || loadingLogin || loadingGoogle}
          >
            {loadingSignup ? "新規登録中..." : "新規登録"}
          </button>

          <button
            type="button"
            className="sh-btn sh-btn--primary"
            style={mainButton}
            onClick={handleLogin}
            disabled={loadingLogin || loadingSignup || loadingGoogle}
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

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/" className="sh-btn">
              トップへ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={pageWrap}>読み込み中…</main>}>
      <LoginPageInner />
    </Suspense>
  );
}

const pageWrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const card: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #e5ece7",
  borderRadius: 24,
  background: "#fff",
  padding: 24,
  boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
};

const blockTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#1f5d30",
};

const redirectInfoBox: React.CSSProperties = {
  marginTop: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #dbe7df",
  background: "#f7fbf8",
  color: "#2d4a37",
  fontSize: 13,
  lineHeight: 1.7,
};

const topButton: React.CSSProperties = {
  width: "100%",
  minHeight: 56,
  fontSize: 18,
  fontWeight: 900,
};

const warnBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #fde68a",
  background: "#fffbeb",
};

const warnTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#92400e",
};

const warnText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  lineHeight: 1.8,
  color: "#78350f",
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