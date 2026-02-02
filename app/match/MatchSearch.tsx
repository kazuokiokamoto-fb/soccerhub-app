"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const GRADES = [
  { value: "U-8", label: "U-8（1・2年）" },
  { value: "U-9", label: "U-9（3年）" },
  { value: "U-10", label: "U-10（4年）" },
  { value: "U-11", label: "U-11（5年）" },
  { value: "U-12", label: "U-12（6年）" },
];

const PREFECTURES = [
  "東京都",
  "神奈川県",
  "千葉県",
  "埼玉県",
  // 必要に応じて追加
];

export default function MatchSearch() {
  const router = useRouter();
  const sp = useSearchParams();

  const [grade, setGrade] = useState(sp.get("grade") ?? "");
  const [prefecture, setPrefecture] = useState(sp.get("prefecture") ?? "");
  const [city, setCity] = useState(sp.get("city") ?? "");

  const onSearch = () => {
    if (!grade || !prefecture) {
      alert("学年と都道府県は必須です");
      return;
    }

    const params = new URLSearchParams();
    params.set("grade", grade);
    params.set("prefecture", prefecture);
    if (city.trim()) params.set("city", city.trim());

    router.push(`/match?${params.toString()}`);
  };

  return (
    <section
      style={{
        border: "1px solid #eee",
        borderRadius: 14,
        padding: 16,
        background: "#fafafa",
      }}
    >
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
        🔍 条件で探す
      </h2>

      <div style={{ display: "grid", gap: 12 }}>
        {/* 学年 */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700 }}>学年</label>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={selectStyle}
          >
            <option value="">選択してください</option>
            {GRADES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        {/* エリア */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700 }}>都道府県</label>
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            style={selectStyle}
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            市区町村（任意）
          </label>
          <input
            type="text"
            placeholder="例：世田谷区"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button className="sh-btn" onClick={onSearch}>
          この条件で探す
        </button>
      </div>
    </section>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ddd",
  marginTop: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ddd",
  marginTop: 4,
};