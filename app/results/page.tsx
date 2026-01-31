"use client";
import Link from "next/link";
export default function ResultsPage() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>実績登録（あとで）</h1>
      <Link href="/" style={{ textDecoration: "none" }}><button style={btn}>トップへ</button></Link>
    </main>
  );
}
const btn: React.CSSProperties = { padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer" };