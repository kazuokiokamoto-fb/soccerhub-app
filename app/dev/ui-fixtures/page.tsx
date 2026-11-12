import { notFound } from "next/navigation";
import { Suspense } from "react";
import UiFixtures from "./Fixtures";

export const dynamic = "force-dynamic";

export default function UiFixturesPage() {
  if (process.env.UI_FIXTURES !== "1" || process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={<p>読み込み中です。</p>}>
      <UiFixtures />
    </Suspense>
  );
}
