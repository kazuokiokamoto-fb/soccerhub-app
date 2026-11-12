"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

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
  const [mode, setMode] = useState<"in" | "up">("in");

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

  const busy = loadingGoogle || loadingLogin || loadingSignup;

  return (
    <main className="sm-screen">
      <section className="sm-card sm-stack">
        <h1 className="sm-title">{mode === "in" ? "ログイン" : "新規登録"}</h1>
        <div className="sm-seg" role="group" aria-label="ログインか登録">
          <button type="button" aria-pressed={mode === "in"} onClick={() => setMode("in")}>
            ログイン
          </button>
          <button type="button" aria-pressed={mode === "up"} onClick={() => setMode("up")}>
            新規登録
          </button>
        </div>

        {redirectPath !== "/" ? (
          <p className="status-chip status-chip--info">戻り先 {redirectPath}</p>
        ) : null}

        <button type="button" className="sh-btn" onClick={handleGoogleLogin} disabled={busy}>
          {loadingGoogle ? "移動中…" : "Google"}
        </button>

        {isLineInAppBrowser ? (
          <p className="sm-feedback" role="status">
            LINE内ブラウザでは Googleログイン不可。Safari / Chrome で開き直してください。
          </p>
        ) : null}

        <label className="chip-block">
          <span>メール</span>
          <input
            type="email"
            className="sh-input"
            placeholder="example@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="chip-block">
          <span>パスワード</span>
          <input
            type="password"
            className="sh-input"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "up" ? "new-password" : "current-password"}
          />
        </label>

        <button
          type="button"
          className="sh-btn sh-btn--primary"
          onClick={mode === "in" ? handleLogin : handleSignup}
          disabled={busy}
        >
          {mode === "in"
            ? loadingLogin
              ? "ログイン中..."
              : "ログイン"
            : loadingSignup
              ? "新規登録中..."
              : "登録する"}
        </button>

        {message ? (
          <p className="sm-feedback" role="status">
            {message}
          </p>
        ) : null}

        <details className="sm-more">
          <summary>はじめての方</summary>
          <div className="sm-more-body">
            <p className="sm-meta">
              まずはログイン後にチーム登録をすると、練習試合の募集や申込みができるようになります。
            </p>
            <Link href="/" className="sm-quiet">
              トップへ
            </Link>
          </div>
        </details>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="sm-screen">読み込み中…</main>}>
      <LoginPageInner />
    </Suspense>
  );
}
