const CURRENT_YEAR = new Date().getFullYear();

export const MAX_PAGES_PER_SOURCE = 120;
export const MAX_EVENTS_PER_SOURCE = 15;
export const MAX_EXTERNAL_LINKS_PER_PAGE = 8;
export const MAX_EXTERNAL_HOSTS_PER_SOURCE = 8;
export const MAX_EXTERNAL_DEPTH = 2;

export const MAX_SEARCH_QUERIES_PER_SOURCE = 8;
export const MAX_SEARCH_RESULTS_PER_QUERY = 5;
export const MAX_SEARCH_URLS_PER_SOURCE = 20;

export const CRAWL_ENTRY_PATHS = [
  "",
  "/",
  "/news/",
  "/info/",
  "/information/",
  "/topics/",
  "/academy/",
  "/academy/news/",
  "/academy/info/",
  "/academy/topics/",
  "/academy/selection/",
  "/academy/recruit/",
  "/school/",
  "/school/news/",
  "/junior-youth/",
  "/junior_youth/",
  "/jy/",
  "/youth/",
  "/recruit/",
  "/selection/",
  "/tryout/",
  "/trial/",
  "/entry/",
  "/join/",
  "/member/",
  "/taiken/",
  "/experience/",
  "/sitemap.xml",
  "/sitemap_index.xml",
];

export const SEARCH_KEYWORDS = [
  "セレクション",
  "ジュニアユース セレクション",
  "U-13 セレクション",
  "新中1 セレクション",
  "選手募集",
  "参加者募集",
  "体験練習会",
  "練習会",
  "体験会",
  "アカデミー",
  "ジュニアユース",
  "GK募集",
  "新年度 募集",

  `${CURRENT_YEAR}年度 募集`,
  `${CURRENT_YEAR + 1}年度 募集`,
  `${CURRENT_YEAR} セレクション`,
  `${CURRENT_YEAR + 1} セレクション`,
];

export const YEAR_KEYWORDS = [
  `${CURRENT_YEAR}`,
  `${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR}年度`,
  `${CURRENT_YEAR + 1}年度`,
  `${CURRENT_YEAR}年`,
  `${CURRENT_YEAR + 1}年`,
];

export const KEYWORDS = [
  "セレクション",
  "選考会",
  "追加セレクション",
  "GKセレクション",
  "ゴールキーパーセレクション",

  "トライアウト",
  "tryout",
  "trial",

  "選手募集",
  "参加者募集",
  "団員募集",
  "部員募集",
  "メンバー募集",
  "クラブ生募集",
  "スクール生募集",
  "アカデミー生募集",
  "ジュニアユース募集",
  "ユース募集",
  "ジュニア募集",
  "GK募集",

  "募集",
  "新年度",

  "アカデミー",
  "academy",

  "ジュニアユース",
  "junior youth",
  "junior-youth",

  "新入団",
  "入団",
  "加入",
  "新加入",

  "応募",
  "申込",
  "申し込み",
  "エントリー",
  "entry",
  "join",

  "練習参加",
  "練習会",
  "体験練習",
  "体験練習会",
  "体験会",
  "無料体験会",

  "随時募集",

  "selection",
  "recruit",
  "recruitment",

  "現小学6年",
  "現小6",
  "新中学1年",
  "新中1",

  "U-13",
  "U13",
  "U-15",
  "U15",

  ...YEAR_KEYWORDS,
];

export const EXCLUDE_KEYWORDS = [
  "試合結果",
  "大会結果",
  "順位表",
  "戦績",
  "マッチレポート",
  "代表メンバー",
  "日本代表",
  "ハイライト",
  "チケット",
  "グッズ",
  "観戦",
  "会社概要",
  "プライバシー",
  "個人情報",
  "利用規約",
  "訪問スクール",
  "スクール訪問",
  "出張スクール",
  "訪問指導",
  "巡回指導",
  "派遣指導",
  "幼稚園訪問",
  "保育園訪問",
  "小学校訪問",
];

export const PREFECTURES = [
  "東京都",
  "神奈川県",
  "埼玉県",
  "千葉県",
  "茨城県",
  "栃木県",
  "群馬県",
  "山梨県",
];

export const CITIES = [
  "世田谷区",
  "杉並区",
  "練馬区",
  "大田区",
  "目黒区",
  "渋谷区",
  "新宿区",
  "中野区",
  "板橋区",
  "足立区",
  "江戸川区",
  "江東区",
  "品川区",
  "町田市",
  "調布市",
  "府中市",
  "三鷹市",
  "武蔵野市",
  "八王子市",
  "立川市",
  "横浜市",
  "川崎市",
  "相模原市",
  "藤沢市",
  "大和市",
  "厚木市",
  "さいたま市",
  "川口市",
  "所沢市",
  "越谷市",
  "川越市",
  "千葉市",
  "船橋市",
  "市川市",
  "柏市",
  "松戸市",
  "浦安市",
  "流山市",
  "つくば市",
  "水戸市",
  "宇都宮市",
  "前橋市",
  "高崎市",
];