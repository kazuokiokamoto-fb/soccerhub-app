export default function Home() {
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 34, fontWeight: 800, marginBottom: 6 }}>
        SoccerHub ⚽🔥
      </h1>
      <p style={{ fontSize: 16, color: "#444", marginTop: 0 }}>
        U-12 サッカー練習試合マッチング & 会場比較（β）
      </p>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        <section
          style={{
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#fafafa",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>できること</h2>
          <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>チーム同士の練習試合マッチング</li>
            <li>会場（コート）情報を比較</li>
            <li>
              🚲 駐輪場あり/なし がひと目で分かる（将来は台数・注意点も）
            </li>
          </ul>
        </section>

        <section
          style={{
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>まずはここから</h2>
          <p style={{ marginTop: 10, marginBottom: 12, color: "#444" }}>
            次は「チーム登録」「会場登録」「検索」を順番に作ります。
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
              onClick={() => alert("次は「チーム登録」画面を作ります！")}
            >
              チーム登録（次に作る）
            </button>

            <button
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
              onClick={() => alert("次は「会場登録」画面を作ります！")}
            >
              会場登録（次に作る）
            </button>

            <button
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
              }}
              onClick={() => alert("次は「検索」画面を作ります！")}
            >
              検索（次に作る）
            </button>
          </div>
        </section>
      </div>

      <footer style={{ marginTop: 24, fontSize: 12, color: "#777" }}>
        © SoccerHub / Codespaces
      </footer>
    </main>
  );
}
