"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

function timeout<T>(ms: number, label = "timeout") {
  return new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms));
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const redirect = sp.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const normalizeEmail = (v: string) => v.trim().toLowerCase();
  const canSubmit = useMemo(() => !!email.trim() && !!password, [email, password]);

  // ✅ すでにログイン済みなら、ここに来た時点で戻す（無限ループ防止で /login には行かない）
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace(redirect);
        router.refresh();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goAfterAuth = (path?: string) => {
    const to = path ?? redirect ?? "/";
    setMsg(`✅ 認証OK。移動します → ${to}`);
    router.replace(to);
    router.refresh(); // ★これがないと middleware 側が未ログイン判定になりがち
  };

  // ① まず “supabaseが返ってくるか” の疎通確認
  const testConnection = async () => {
    setLoading(true);
    setMsg("🔎 接続テスト中…（getSession / 10秒）");

    try {
      const res = await Promise.race([
        supabase.auth.getSession(),
        timeout<any>(10000, "getSession timeout (10s)"),
      ]);

      setMsg(`✅ getSession 返ってきた\nsession: ${res?.data?.session ? "あり" : "なし"}`);
    } catch (e: any) {
      setMsg(`❌ 接続テスト失敗: ${e?.message ?? String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setLoading(false);
    setMsg("🔄 リセットしました");
    setEmail("");
    setPassword("");
  };

  const signUp = async () => {
    setLoading(true);
    setMsg("🟡 新規登録リクエスト送信中…（10秒待つ）");

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

      // Confirm email が OFF なら session が返り、そのままログイン完了
      if (data?.session) {
        goAfterAuth();
        return;
      }

      setMsg("✅ 登録受付しました。\n（Confirm email がONならメール確認が必要です）");
    } catch (e: any) {
      setMsg(
        `❌ 新規登録が返ってきません: ${e?.message ?? String(e)}\n` +
          "→ Supabase URL/Key の間違い、または通信ブロックの可能性が高いです"
      );
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    setLoading(true);
    setMsg("🟡 ログイン中…（10秒待つ）");

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
        setMsg("⚠️ 成功っぽいけど session が空です（設定/キーを確認）");
        return;
      }

      goAfterAuth();
    } catch (e: any) {
      setMsg(
        `❌ ログインが返ってきません: ${e?.message ?? String(e)}\n` +
          "→ Supabase URL/Key の間違い、または通信ブロックの可能性が高いです"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 34, fontWeight: 800, margin: 0 }}>ログイン / 登録</h1>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="sh-btn" href="/" style={{ textDecoration: "none" }}>
          トップへ
        </a>
      </div>

      <div style={{ marginTop: 16 }}>
        <input
          type="email"
          name="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          autoComplete="email"
          style={{
            width: "100%",
            padding: 10,
            fontSize: 16,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="current-password"
          style={{
            width: "100%",
            padding: 10,
            fontSize: 16,
            borderRadius: 10,
            border: "1px solid #ddd",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button className="sh-btn" onClick={signUp} disabled={loading || !canSubmit} type="button">
          {loading ? "処理中…" : "新規登録"}
        </button>

        <button className="sh-btn" onClick={signIn} disabled={loading || !canSubmit} type="button">
          {loading ? "処理中…" : "ログイン"}
        </button>
      </div>

      {msg && (
        <pre
          style={{
            marginTop: 14,
            whiteSpace: "pre-wrap",
            padding: 12,
            borderRadius: 12,
            border: "1px solid #eee",
            background: "#fafafa",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          {msg}
        </pre>
      )}

      <p style={{ marginTop: 12, fontSize: 12, color: "#777" }}>
        ※ メール末尾が <b>gmail.co</b> じゃなく <b>gmail.com</b> か確認
      </p>
    </main>
  );
}