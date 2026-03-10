"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

function timeout<T>(ms: number, label = "timeout") {
  return new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [msg, setMsg] = useState("");

  const normalizeEmail = (v: string) => v.trim().toLowerCase();
  const canSubmit = useMemo(() => !!email.trim() && !!password, [email, password]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        router.replace(redirect);
        router.refresh();
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (
        session &&
        (event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION")
      ) {
        const to = redirect || "/";
        setMsg(`✅ 認証OK。移動します → ${to}`);

        // auth state change の処理と競合しにくいよう少し遅らせる
        setTimeout(() => {
          router.replace(to);
          router.refresh();
        }, 100);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [redirect, router]);

  const goAfterAuth = async (path?: string) => {
    const to = path ?? redirect ?? "/";

    // セッション確定待ち
    for (let i = 0; i < 10; i++) {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setMsg(`✅ 認証OK。移動します → ${to}`);
        router.replace(to);
        router.refresh();
        return;
      }
      await sleep(150);
    }

    // 最後の保険
    setMsg(`✅ 認証OK。移動します → ${to}`);
    router.replace(to);
    router.refresh();
  };

  const signUp = async () => {
    if (!canSubmit) return;

    setLoadingEmail(true);
    setMsg("🟡 新規登録リクエスト送信中…");

    try {
      const em = normalizeEmail(email);

      const { data, error } = await Promise.race([
        supabase.auth.signUp({ email: em, password }),
        timeout<any>(10000, "signUp timeout (10s)"),
      ]);

      if (error) {
        setMsg(`❌ 新規登録エラー: ${error.message}`);
        return;
      }

      if (data?.session) {
        await goAfterAuth();
        return;
      }

      setMsg("✅ 登録受付しました。確認メールが届いているかご確認ください。");
    } catch (e: any) {
      setMsg(
        `❌ 新規登録が返ってきません: ${e?.message ?? String(e)}\n` +
          "→ Supabase設定、または通信環境をご確認ください"
      );
    } finally {
      setLoadingEmail(false);
    }
  };

  const signIn = async () => {
    if (!canSubmit) return;

    setLoadingEmail(true);
    setMsg("🟡 ログイン中…");

    try {
      const em = normalizeEmail(email);

      const { data, error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: em, password }),
        timeout<any>(10000, "signIn timeout (10s)"),
      ]);

      if (error) {
        setMsg(`❌ ログイン失敗: ${error.message}`);
        return;
      }

      if (!data?.session) {
        setMsg("⚠️ 成功っぽいですが session が取得できませんでした。設定をご確認ください。");
        return;
      }

      await goAfterAuth();
    } catch (e: any) {
      setMsg(
        `❌ ログインが返ってきません: ${e?.message ?? String(e)}\n` +
          "→ Supabase設定、または通信環境をご確認ください"
      );
    } finally {
      setLoadingEmail(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoadingGoogle(true);
    setMsg("🟡 Googleログインへ移動します…");

    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://soccerhub-app.vercel.app";

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setMsg(`❌ Googleログイン失敗: ${error.message}`);
        setLoadingGoogle(false);
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setMsg("❌ GoogleログインURLの取得に失敗しました。");
      setLoadingGoogle(false);
    } catch (e: any) {
      setMsg(`❌ Googleログインエラー: ${e?.message ?? String(e)}`);
      setLoadingGoogle(false);
    }
  };

  return (
    <main style={page}>
      <div style={card}>
        <div style={brandRow}>
          <div style={logoBall}>⚽</div>
          <div>
            <div style={brand}>サカまち</div>
            <div style={brandSub}>Soccer Match Hub</div>
          </div>
        </div>

        <h1 style={title}>ログイン / 登録</h1>
        <p style={lead}>チーム登録や練習試合マッチングを始めるにはログインしてください。</p>

        <div style={topActions}>
          <Link href="/" className="sh-btn sh-btn--ghost">
            トップへ
          </Link>
        </div>

        <section style={section}>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loadingGoogle || loadingEmail}
            style={{
              ...oauthBtn,
              opacity: loadingGoogle || loadingEmail ? 0.7 : 1,
              cursor: loadingGoogle || loadingEmail ? "not-allowed" : "pointer",
            }}
          >
            <span style={googleIcon}>G</span>
            <span>{loadingGoogle ? "Googleへ移動中…" : "Googleでログイン"}</span>
          </button>
        </section>

        <div style={divider}>
          <span style={dividerText}>またはメールで続ける</span>
        </div>

        <section style={section}>
          <label style={label}>
            <span style={labelTitle}>メールアドレス</span>
            <input
              type="email"
              name="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              autoComplete="email"
              className="sh-input"
              disabled={loadingEmail || loadingGoogle}
            />
          </label>

          <label style={label}>
            <span style={labelTitle}>パスワード</span>
            <input
              type="password"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="current-password"
              className="sh-input"
              disabled={loadingEmail || loadingGoogle}
            />
          </label>

          <div style={buttonRow}>
            <button
              className="sh-btn sh-btn--ghost"
              onClick={signUp}
              disabled={loadingEmail || loadingGoogle || !canSubmit}
              type="button"
            >
              {loadingEmail ? "処理中…" : "新規登録"}
            </button>

            <button
              className="sh-btn sh-btn--primary"
              onClick={signIn}
              disabled={loadingEmail || loadingGoogle || !canSubmit}
              type="button"
            >
              {loadingEmail ? "処理中…" : "ログイン"}
            </button>
          </div>
        </section>

        <section style={infoBox}>
          <div style={infoTitle}>はじめて使う方へ</div>
          <div style={infoText}>
            ・Googleアカウントですぐログインできます。<br />
            ・メールでも新規登録できます。<br />
            ・ログイン後にチーム登録へ進めます。
          </div>
        </section>

        {msg ? <pre style={messageBox}>{msg}</pre> : null}

        <p style={note}>
          ※ メール末尾が <b>gmail.co</b> ではなく <b>gmail.com</b> かご確認ください。
        </p>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100dvh",
  padding: "24px 16px",
  display: "grid",
  alignItems: "start",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 560,
  margin: "0 auto",
  background: "#ffffff",
  border: "1px solid #e4ebe6",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 10px 30px rgba(20, 92, 42, 0.08)",
};

const brandRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  marginBottom: 18,
};

const logoBall: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  fontSize: 28,
  boxShadow: "0 8px 18px rgba(20,92,42,0.18)",
};

const brand: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  lineHeight: 1.1,
  color: "#1f5d30",
  letterSpacing: 0.4,
};

const brandSub: React.CSSProperties = {
  marginTop: 2,
  fontSize: 14,
  color: "#6a7c70",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 30,
  fontWeight: 900,
  color: "#142033",
};

const lead: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#66756d",
  lineHeight: 1.7,
  fontSize: 14,
};

const topActions: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const section: React.CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 18,
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
  fontSize: 14,
};

const oauthBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 54,
  borderRadius: 14,
  border: "1px solid #d9e4dc",
  background: "#fff",
  color: "#21342a",
  fontWeight: 800,
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
};

const googleIcon: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#fff",
  border: "1px solid #e5e7eb",
  color: "#4285F4",
  fontWeight: 900,
  fontSize: 16,
};

const divider: React.CSSProperties = {
  position: "relative",
  marginTop: 20,
  textAlign: "center",
};

const dividerText: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  background: "#fff",
  padding: "0 12px",
  color: "#7a887f",
  fontSize: 13,
};

const buttonRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 4,
};

const infoBox: React.CSSProperties = {
  marginTop: 18,
  padding: 14,
  border: "1px solid #d6eadb",
  borderRadius: 16,
  background: "#f5fbf6",
};

const infoTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
  marginBottom: 6,
};

const infoText: React.CSSProperties = {
  fontSize: 13,
  color: "#55665c",
  lineHeight: 1.7,
};

const messageBox: React.CSSProperties = {
  marginTop: 16,
  whiteSpace: "pre-wrap",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #eee",
  background: "#fafafa",
  fontSize: 13,
  lineHeight: 1.6,
  overflowX: "auto",
};

const note: React.CSSProperties = {
  marginTop: 14,
  fontSize: 12,
  color: "#777",
  lineHeight: 1.7,
};