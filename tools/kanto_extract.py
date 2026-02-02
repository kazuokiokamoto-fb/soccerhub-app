import csv
from pathlib import Path

IN_FILE = Path("utf_ken_all.csv")
OUT_TOWNS = Path("kanto_towns.csv")
OUT_MUNI = Path("kanto_municipalities.csv")

KANTO_PREFS = {"東京都", "神奈川県", "千葉県", "埼玉県", "茨城県", "栃木県", "群馬県"}

def norm(s: str) -> str:
    return (s or "").strip()

def main():
    towns = set()
    munis = set()

    with IN_FILE.open("r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            # utf_ken_all.csv の主要カラム
            # 0: 全国地方公共団体コード
            # 1: 旧郵便番号
            # 2: 郵便番号
            # 6: 都道府県名
            # 7: 市区町村名
            # 8: 町域名
            if len(row) < 9:
                continue

            pref = norm(row[6])
            city = norm(row[7])
            town = norm(row[8])

            if pref not in KANTO_PREFS:
                continue

            if town == "以下に掲載がない場合":
                town = ""

            towns.add((pref, city, town))
            munis.add((pref, city))

    with OUT_TOWNS.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["prefecture", "city", "town"])
        for r in sorted(towns):
            w.writerow(r)

    with OUT_MUNI.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["prefecture", "city"])
        for r in sorted(munis):
            w.writerow(r)

    print("✅ 完了")
    print(" towns:", len(towns))
    print(" municipalities:", len(munis))

if __name__ == "__main__":
    main()