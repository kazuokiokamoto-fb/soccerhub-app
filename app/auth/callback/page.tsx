"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

function AuthCallbackInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const redirect = sp.get("redirect") || "/";

      // まずセッション確認
      for (let i = 0; i < 12; i++) {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!error && data.session) {
          router.replace(redirect);
          router.refresh();
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
      router.refresh();
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