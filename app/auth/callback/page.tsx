"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRedirect(input: string | null | undefined) {
  if (!input) return "/";
  if (!input.startsWith("/")) return "/";
  if (input.startsWith("//")) return "/";
  return input;
}

function AuthCallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const redirect = normalizeRedirect(sp.get("redirect"));

      try {
        // まずURL上の認証情報をセッションへ反映
        // OAuthの戻り直後に安定しやすくするため
        await supabase.auth.getSession();

        // セッション確定待ち
        for (let i = 0; i < 12; i++) {
          const { data, error } = await supabase.auth.getSession();

          if (!mounted) return;

          if (!error && data.session) {
            router.replace(redirect);
            router.refresh();
            return;
          }

          await sleep(200);
        }

        router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
        router.refresh();
      } catch (e) {
        console.error("auth callback error:", e);
        if (!mounted) return;
        router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
        router.refresh();
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [router, sp]);

  return <main style={{ padding: 24 }}>認証確認中...</main>;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>認証確認中...</main>}>
      <AuthCallbackInner />
    </Suspense>
  );
}