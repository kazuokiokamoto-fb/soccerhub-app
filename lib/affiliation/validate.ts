import {
  isAffiliationCategory,
  isAffiliationPrefecture,
  type AffiliationCategory,
  type AffiliationPrefecture,
} from "./catalog.ts";

export type AffiliationDraft = {
  none: boolean;
  prefecture: string;
  category: string;
  organizationName: string;
};

export type AffiliationValue =
  | { status: "none" }
  | {
      status: "affiliated";
      prefecture: AffiliationPrefecture;
      category: AffiliationCategory;
      organizationName: string;
    };

export function validateAffiliation(
  input: AffiliationDraft,
): { ok: true; value: AffiliationValue } | { ok: false; message: string } {
  if (input.none) return { ok: true, value: { status: "none" } };

  const prefecture = input.prefecture.trim();
  const category = input.category.trim();
  const organizationName = input.organizationName.trim().replace(/\s+/g, " ");

  if (!prefecture || !category || !organizationName) {
    return {
      ok: false,
      message: "都道府県、カテゴリ、所属リーグ・連盟名を入力してください。所属がない場合は「所属なし」を選んでください。",
    };
  }
  if (!isAffiliationPrefecture(prefecture)) {
    return { ok: false, message: "都道府県を選び直してください。" };
  }
  if (!isAffiliationCategory(category)) {
    return { ok: false, message: "カテゴリを選び直してください。" };
  }
  if (organizationName.length > 80) {
    return { ok: false, message: "所属リーグ・連盟名は80文字以内にしてください。" };
  }
  return {
    ok: true,
    value: { status: "affiliated", prefecture, category, organizationName },
  };
}
