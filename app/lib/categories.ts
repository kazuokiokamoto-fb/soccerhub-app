// app/lib/categories.ts

export type CategoryValue =
  | "KIDS"
  | "G1"
  | "G2"
  | "G3"
  | "G4"
  | "G5"
  | "G6"
  | "U15"
  | "U18"
  | "U23"
  | "OPEN"
  | "O40"
  | "O50";

export type CategoryOption = {
  value: CategoryValue;
  label: string;
};

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "KIDS", label: "キッズ（未就学）" },
  { value: "G1", label: "小学1年" },
  { value: "G2", label: "小学2年" },
  { value: "G3", label: "小学3年" },
  { value: "G4", label: "小学4年" },
  { value: "G5", label: "小学5年" },
  { value: "G6", label: "小学6年" },
  { value: "U15", label: "U-15" },
  { value: "U18", label: "U-18" },
  { value: "U23", label: "U-23" },
  { value: "OPEN", label: "一般" },
  { value: "O40", label: "シニアO40" },
  { value: "O50", label: "シニアO50" },
];

export const CATEGORY_GROUPS: {
  title: string;
  values: CategoryValue[];
}[] = [
  {
    title: "キッズ",
    values: ["KIDS"],
  },
  {
    title: "小学生",
    values: ["G1", "G2", "G3", "G4", "G5", "G6"],
  },
  {
    title: "ユース",
    values: ["U15", "U18", "U23"],
  },
  {
    title: "一般・シニア",
    values: ["OPEN", "O40", "O50"],
  },
];

export function categoryLabel(v: string | null | undefined) {
  if (!v) return "";

  const normalized = String(v).trim().toUpperCase();

  const aliasMap: Record<string, CategoryValue> = {
    KIDS: "KIDS",

    G1: "G1",
    G2: "G2",
    G3: "G3",
    G4: "G4",
    G5: "G5",
    G6: "G6",

    U15: "U15",
    "U-15": "U15",
    U18: "U18",
    "U-18": "U18",
    U23: "U23",
    "U-23": "U23",

    OPEN: "OPEN",
    一般: "OPEN",

    O40: "O40",
    "O-40": "O40",
    O50: "O50",
    "O-50": "O50",

    KIDS_OLD: "KIDS",
    ELEMENTARY_1: "G1",
    ELEMENTARY_2: "G2",
    ELEMENTARY_3: "G3",
    ELEMENTARY_4: "G4",
    ELEMENTARY_5: "G5",
    ELEMENTARY_6: "G6",
  };

  const resolved = aliasMap[normalized] ?? (normalized as CategoryValue);
  const hit = CATEGORY_OPTIONS.find((o) => o.value === resolved);

  return hit?.label ?? v;
}

export function categoryLabels(values: string[] | null | undefined) {
  const arr = Array.isArray(values) ? values : [];
  return arr.map(categoryLabel).filter(Boolean);
}