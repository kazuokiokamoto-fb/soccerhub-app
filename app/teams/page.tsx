import TeamsPageClient from "./components/TeamsPageClient";

// このページは useSearchParams() を使うクライアントコンポーネントを含むため、
// 静的プリレンダリング時のビルドエラーを避けるため常に動的レンダリングにする
export const dynamic = "force-dynamic";

export default function TeamsPage() {
  return <TeamsPageClient />;
}
