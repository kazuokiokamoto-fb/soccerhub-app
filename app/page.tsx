export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 32, fontWeight: "bold" }}>
        SoccerHub ⚽️🔥
      </h1>

      <p style={{ marginTop: 12, fontSize: 18 }}>
        U-12 サッカー練習試合マッチング & 会場比較
      </p>

      <ul style={{ marginTop: 20, paddingLeft: 20, lineHeight: 1.8 }}>
        <li>チーム同士の練習試合マッチング</li>
        <li>会場（コート）情報を比較</li>
        <li>🚲 駐輪場あり・なしがひと目で分かる</li>
      </ul>
    </main>
  );
}