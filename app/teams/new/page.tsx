"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "../../lib/supabase";
import { GradeKey } from "../../lib/types";

// ✅ カテゴリ統一（あなたが作った categories.ts を参照）
import { CATEGORY_OPTIONS } from "@/app/lib/categories";

const gradeKeys: GradeKey[] = ["G1", "G2", "G3", "G4", "G5", "G6"];

type Toast = { type: "success" | "error" | "info"; text: string };

// 23区だけ先に運用
type WardRow = { ward: string };
type AreaRow = { ward: string; name: string }; // tokyo_areas

function makeDefaultRoster11(): Record<GradeKey, string> {
  return { G1: "11", G2: "11", G3: "11", G4: "11", G5: "11", G6: "11" };
}

// ✅ DBが空でも町名候補が出るフォールバック
const FALLBACK_TOWNS_BY_WARD: Record<string, string[]> = {
  世田谷区: ["三宿", "池尻", "下馬", "太子堂", "三軒茶屋", "駒沢", "桜新町", "用賀", "二子玉川", "奥沢", "等々力", "深沢"],
  目黒区: ["中目黒", "青葉台", "上目黒", "下目黒", "目黒", "五本木", "鷹番", "祐天寺"],
  渋谷区: ["恵比寿", "広尾", "代官山", "神宮前", "渋谷", "松濤", "代々木"],
  港区: ["南青山", "北青山", "西麻布", "六本木", "麻布十番", "白金", "高輪", "芝", "赤坂"],
};

export default function TeamNewPage() {
  const router = useRouter();

  // --- base fields ---
  const [name, setName] = useState("");
  // ✅ デフォルトは options の先頭（なければ空）
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]?.value ?? "");
  const [level, setLevel] = useState(5);
  const [hasGround, setHasGround] = useState(false);
  const [bikeParking, setBikeParking] = useState("不明");
  const [uniformMain, setUniformMain] = useState("");
  const [uniformSub, setUniformSub] = useState("");

  // ✅ エリア入力（区＋町名）
  const [prefecture] = useState("東京都"); // まず固定
  const [ward, setWard] = useState<string>(""); // 23区
  const [neighborhood, setNeighborhood] = useState<string>(""); // 町名（datalist候補あり）

  // 23区候補 & 町名候補（tokyo_areas が空でもOK）
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);

  // ✅ 0が消せない問題対策：入力は string で持つ（空欄OK）
  const [rosterByGradeText, setRosterByGradeText] = useState<Record<GradeKey, string>>(makeDefaultRoster11());

  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const canSave = useMemo(() => {
    // チーム名 + 区（最低限）
    return !!name.trim() && !!ward.trim() && !saving;
  }, [name, ward, saving]);

  // toast auto close
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ✅ 23区をDBからロード（ダメならフォールバック）
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("tokyo_23wards").select("ward").order("ward");
      if (error) {
        console.error(error);
        setWardOptions([
          "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区", "品川区", "目黒区",
          "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区", "北区", "荒川区", "板橋区", "練馬区",
          "足立区", "葛飾区", "江戸川区",
        ]);
        return;
      }
      const rows = (data ?? []) as WardRow[];
      const list = rows.map((r) => r.ward).filter(Boolean);

      // DBが空だった時もフォールバック
      if (list.length === 0) {
        setWardOptions([
          "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区", "品川区", "目黒区",
          "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区", "北区", "荒川区", "板橋区", "練馬区",
          "足立区", "葛飾区", "江戸川区",
        ]);
      } else {
        setWardOptions(list);
      }
    })();
  }, []);

  // ✅ ward が変わったら町名候補をロード（tokyo_areas が空でもOK）
  useEffect(() => {
    (async () => {
      setAreaOptions([]);
      if (!ward) return;

      // まずDBから試す
      const { data, error } = await supabase
        .from("tokyo_areas")
        .select("ward,name")
        .eq("ward", ward)
        .order("name");

      if (error) {
        console.warn("tokyo_areas load skipped:", error.message);
        // DBが無理ならフォールバック
        setAreaOptions(FALLBACK_TOWNS_BY_WARD[ward] ?? []);
        return;
      }

      const rows = (data ?? []) as AreaRow[];
      const dbList = rows.map((r) => r.name).filter(Boolean);

      // DBが空ならフォールバック
      if (dbList.length === 0) {
        setAreaOptions(FALLBACK_TOWNS_BY_WARD[ward] ?? []);
      } else {
        setAreaOptions(dbList);
      }
    })();
  }, [ward]);

  const resetForm = () => {
    setName("");
    setCategory(CATEGORY_OPTIONS[0]?.value ?? "");
    setLevel(5);
    setHasGround(false);
    setBikeParking("不明");
    setUniformMain("");
    setUniformSub("");
    setWard("");
    setNeighborhood("");
    setRosterByGradeText(makeDefaultRoster11());
    setNote("");
  };

  const save = async () => {
    if (!name.trim()) {
      setToast({ type: "error", text: "チーム名は必須です" });
      return;
    }
    if (!ward.trim()) {
      setToast({ type: "error", text: "区（23区）を選んでください" });
      return;
    }
    if (!category.trim()) {
      setToast({ type: "error", text: "カテゴリを選んでください" });
      return;
    }

    setSaving(true);
    setToast({ type: "info", text: "保存中…" });

    // roster: 空欄は 0 扱い
    const roster_by_grade = gradeKeys.reduce((acc, g) => {
      const v = (rosterByGradeText[g] ?? "").trim();
      acc[g] = v === "" ? 0 : Math.max(0, Number(v) || 0);
      return acc;
    }, {} as Record<GradeKey, number>);

    // ✅ owner_id を必ず入れる（RLS対策）
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) console.error(userErr);

    if (!user) {
      setToast({ type: "error", text: "ログインが必要です" });
      setSaving(false);
      return;
    }

    // ✅ 互換用 area（既存で使ってるので自動生成して残す）
    // 例： "世田谷区・三宿"
    const areaText = `${ward}${neighborhood?.trim() ? "・" + neighborhood.trim() : ""}`;

    const payload: any = {
      owner_id: user.id,
      name: name.trim(),
      category: category.trim(),
      level,
      has_ground: hasGround,
      bike_parking: bikeParking,
      uniform_main: uniformMain.trim() || "不明",
      uniform_sub: uniformSub.trim() || "不明",
      roster_by_grade, // jsonb
      note: note || "",

      // ✅新：区・町名・都道府県
      prefecture,
      ward,
      neighborhood: neighborhood.trim() || null,

      // ✅互換：area（既存の検索/表示に効く）
      area: areaText,
    };

    try {
      const { data, error } = await supabase.from("teams").insert(payload).select("id").single();

      if (error) {
        console.error(error);
        setToast({
          type: "error",
          text: `保存に失敗しました: ${error.message}\n（RLS/列名/NULL制約あたりが原因のことが多いです）`,
        });
        return;
      }

      setToast({ type: "success", text: "✅ チームを登録しました" });

      router.push(`/teams?created=${encodeURIComponent(data.id)}`);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Toast */}
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success" ? toastSuccess : toast.type === "error" ? toastError : toastInfo),
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{toast.text}</div>
          <button type="button" onClick={() => setToast(null)} style={toastClose} aria-label="閉じる">
            ×
          </button>
        </div>
      ) : null}

      <h1 style={{ margin: 0 }}>チーム登録</h1>
      <p style={{ color: "#555", marginTop: 6 }}>Supabase（DB）に保存します。</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/teams" className="sh-btn">
          一覧へ
        </Link>
        <Link href="/" className="sh-btn">
          トップへ
        </Link>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <label style={label}>
            <span>チーム名（必須）</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={input}
              placeholder="例：MPSC"
              disabled={saving}
            />
          </label>

          {/* ✅ エリア（区＋町名） */}
          <div style={{ ...card, background: "#fafafa" }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>エリア（23区 → 町名）</div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <label style={label}>
                <span>都道府県</span>
                <input value={prefecture} style={{ ...input, background: "#f8f8f8" }} disabled />
              </label>

              <label style={label}>
                <span>区（必須）</span>
                <select
                  value={ward}
                  onChange={(e) => {
                    setWard(e.target.value);
                    setNeighborhood("");
                  }}
                  style={input}
                  disabled={saving}
                >
                  <option value="">選択してください</option>
                  {wardOptions.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label style={{ ...label, marginTop: 10 }}>
              <span>町名（任意：検索して入力）</span>
              <input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                style={input}
                placeholder={ward ? "例：三宿 / 下目黒 / 南青山 など" : "先に区を選んでください"}
                disabled={saving || !ward}
                list="neighborhood-list"
              />

              {/* ✅ 候補（DB or フォールバック） */}
              <datalist id="neighborhood-list">
                {areaOptions.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>

              <span style={{ color: "#777", fontSize: 12 }}>
                表示例：
                {ward ? <b>{`${ward}${neighborhood.trim() ? "・" + neighborhood.trim() : ""}`}</b> : "（未選択）"}
              </span>
            </label>

            {/* ✅ 候補が無い時の案内 */}
            {ward && areaOptions.length === 0 ? (
              <div style={{ marginTop: 8, fontSize: 12, color: "#777" }}>
                ※ 町名候補がまだありません（自由入力OK）
              </div>
            ) : null}
          </div>

          {/* ✅ カテゴリ（統一） */}
          <label style={label}>
            <span>カテゴリ</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={input} disabled={saving}>
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label style={label}>
            <span>強さ（自己申告 1〜10）：{level}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              style={{ width: "100%" }}
              disabled={saving}
            />
          </label>

          <label style={{ ...checkLabel, opacity: saving ? 0.7 : 1 }}>
            <input type="checkbox" checked={hasGround} onChange={(e) => setHasGround(e.target.checked)} disabled={saving} />
            自チームでグラウンド提供できる
          </label>

          <label style={label}>
            <span>🚲 駐輪場（チーム側）</span>
            <select value={bikeParking} onChange={(e) => setBikeParking(e.target.value)} style={input} disabled={saving}>
              <option value="あり">あり</option>
              <option value="なし">なし</option>
              <option value="不明">不明</option>
            </select>
          </label>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <label style={label}>
              <span>ユニフォーム（メイン）</span>
              <input value={uniformMain} onChange={(e) => setUniformMain(e.target.value)} style={input} placeholder="例：青" disabled={saving} />
            </label>
            <label style={label}>
              <span>ユニフォーム（サブ）</span>
              <input value={uniformSub} onChange={(e) => setUniformSub(e.target.value)} style={input} placeholder="例：白" disabled={saving} />
            </label>
          </div>

          {/* roster */}
          <div style={{ ...card, background: "#fafafa" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontWeight: 800 }}>各学年の人数（ざっくり）</div>
              <button
                type="button"
                className="sh-btn"
                style={{ padding: "6px 10px" }}
                onClick={() => setRosterByGradeText(makeDefaultRoster11())}
                disabled={saving}
              >
                11人でリセット
              </button>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, 1fr)", marginTop: 10 }}>
              {gradeKeys.map((g) => (
                <label key={g} style={label}>
                  <span>{g}</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={rosterByGradeText[g]}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const cleaned = raw.replace(/[^\d]/g, "");
                      setRosterByGradeText({ ...rosterByGradeText, [g]: cleaned });
                    }}
                    style={input}
                    placeholder="空欄OK"
                    disabled={saving}
                  />
                </label>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", color: "#777", fontSize: 12 }}>※ 空欄もOK（保存時は 0 扱い）</p>
          </div>

          <label style={label}>
            <span>メモ（任意）</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, minHeight: 90 }} disabled={saving} />
          </label>

          <button className="sh-btn" onClick={save} type="button" disabled={!canSave}>
            {saving ? "保存中..." : "保存"}
          </button>

          <p style={{ margin: 0, color: "#777", fontSize: 12 }}>
            ※ 保存後は自動で一覧に戻ります（登録したチームがハイライト表示されます）
          </p>
        </div>
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  padding: 16,
  border: "1px solid #eee",
  borderRadius: 12,
  background: "#fff",
};

const label: React.CSSProperties = { display: "grid", gap: 6 };

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};

const checkLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  border: "1px solid #eee",
  borderRadius: 10,
  background: "#fafafa",
};

// --- toast styles ---
const toastBox: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 12,
};

const toastSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
  color: "#166534",
};

const toastError: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
  color: "#1e3a8a",
};

const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};