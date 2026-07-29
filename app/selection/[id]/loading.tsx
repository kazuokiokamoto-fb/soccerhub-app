// /app/selection/[id]/loading.tsx
import type { CSSProperties } from "react";

// [追加] 詳細ページ(app/selection/[id]/page.tsx)はServer Componentで、
// Supabaseからのデータ取得(fetchSelectionEventById)が完了するまで
// ブラウザには何も表示されず、「フリーズしたような」見え方になっていた。
// Next.jsのloading.tsx規約ファイルを配置するだけで、遷移直後に
// 即座にこのスケルトン画面が表示されるようになり、体感速度が向上する。
export default function SelectionDetailLoading() {
  return (
    <main style={wrap}>
      <div style={topBarSkeleton}>
        <div style={backButtonSkeleton} />
        <div style={backButtonSkeleton} />
      </div>

      <section className="ui-card" style={heroSkeleton}>
        <div style={badgeRowSkeleton}>
          <div style={badgeSkeleton} />
          <div style={badgeSkeleton} />
        </div>

        <div style={titleSkeleton} />
        <div style={titleSkeletonShort} />

        <div style={orgSkeleton} />

        <div style={summaryRowSkeleton}>
          <div style={summaryLineSkeleton} />
        </div>

        <div style={infoGridSkeleton}>
          <div style={infoBoxSkeleton} />
          <div style={infoBoxSkeleton} />
        </div>
      </section>

      <section className="ui-card" style={detailSkeleton}>
        <div style={sectionTitleSkeleton} />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={rowSkeleton} />
        ))}
      </section>
    </main>
  );
}

const shimmer: CSSProperties = {
  background:
    "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)",
  backgroundSize: "200% 100%",
  animation: "sh-shimmer 1.4s ease-in-out infinite",
  borderRadius: 8,
};

const wrap: CSSProperties = {
  padding: 16,
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 12,
};

const topBarSkeleton: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const backButtonSkeleton: CSSProperties = {
  ...shimmer,
  width: 90,
  height: 36,
};

const heroSkeleton: CSSProperties = {
  padding: 16,
};

const badgeRowSkeleton: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
};

const badgeSkeleton: CSSProperties = {
  ...shimmer,
  width: 90,
  height: 26,
  borderRadius: 999,
};

const titleSkeleton: CSSProperties = {
  ...shimmer,
  width: "85%",
  height: 26,
  marginTop: 14,
};

const titleSkeletonShort: CSSProperties = {
  ...shimmer,
  width: "55%",
  height: 26,
  marginTop: 8,
};

const orgSkeleton: CSSProperties = {
  ...shimmer,
  width: "40%",
  height: 18,
  marginTop: 12,
};

const summaryRowSkeleton: CSSProperties = {
  marginTop: 14,
};

const summaryLineSkeleton: CSSProperties = {
  ...shimmer,
  width: "100%",
  height: 40,
};

const infoGridSkeleton: CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const infoBoxSkeleton: CSSProperties = {
  ...shimmer,
  height: 64,
  borderRadius: 14,
};

const detailSkeleton: CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 12,
};

const sectionTitleSkeleton: CSSProperties = {
  ...shimmer,
  width: "30%",
  height: 22,
  marginBottom: 4,
};

const rowSkeleton: CSSProperties = {
  ...shimmer,
  height: 20,
};
