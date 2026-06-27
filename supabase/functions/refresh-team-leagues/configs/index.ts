export type LeagueSiteConfig = {
  key: string;
  prefecture: string;
  category: string;
  hostIncludes: string[];
  startUrl: string;
  leagueWords: string[];
  rankingWords: string[];
  negativeWords: string[];
};

export const LEAGUE_SITE_CONFIGS: LeagueSiteConfig[] = [
  {
    key: "kanto",
    prefecture: "関東",
    category: "U15",
    hostIncludes: ["kanto-cy.com"],
    startUrl: "https://www.kanto-cy.com/",
    leagueWords: ["関東", "1部", "2部"],
    rankingWords: ["順位表", "星取表", "戦績表", "standing", "standings", "table", "league"],
    negativeWords: ["要項", "日程", "ニュース", "PDF", "トーナメント"],
  },
  {
    key: "tokyo",
    prefecture: "東京都",
    category: "U15",
    hostIncludes: ["tokyo-cy.jp"],
    startUrl: "https://tokyo-cy.jp/",
    leagueWords: ["T1", "T2", "T3", "T4"],
    rankingWords: ["順位表", "星取表", "戦績表", "standing", "standings", "table", "league"],
    negativeWords: ["要項", "日程", "ニュース", "PDF", "高円宮杯", "トーナメント"],
  },
  {
    key: "kanagawa",
    prefecture: "神奈川県",
    category: "U15",
    hostIncludes: ["kanagawa-cy.com", "kanagawa-fa.gr.jp"],
    startUrl: "https://kanagawa-cy.com/",
    leagueWords: ["1部", "2部", "3部", "4部", "K1", "K2", "K3", "K4"],
    rankingWords: ["順位表", "星取表", "戦績表", "standing", "standings", "table", "league"],
    negativeWords: ["要項", "日程", "ニュース", "PDF", "トーナメント"],
  },
  {
    key: "saitama",
    prefecture: "埼玉県",
    category: "U15",
    hostIncludes: ["saitama-cy.com"],
    startUrl: "https://saitama-cy.com/",
    leagueWords: ["1部", "2部", "3部", "4部", "S1", "S2", "S3", "S4"],
    rankingWords: ["順位表", "星取表", "戦績表", "standing", "standings", "table", "league"],
    negativeWords: ["要項", "日程", "ニュース", "PDF", "トーナメント"],
  },
  {
    key: "chiba",
    prefecture: "千葉県",
    category: "U15",
    hostIncludes: ["chiba-cy.com"],
    startUrl: "https://chiba-cy.com/",
    leagueWords: ["1部", "2部", "3部", "4部", "C1", "C2", "C3", "C4"],
    rankingWords: ["順位表", "星取表", "戦績表", "standing", "standings", "table", "league"],
    negativeWords: ["要項", "日程", "ニュース", "PDF", "トーナメント"],
  },
  {
    key: "ibaraki",
    prefecture: "茨城県",
    category: "U15",
    hostIncludes: ["ibaraki-cy.com"],
    startUrl: "https://ibaraki-cy.com/",
    leagueWords: ["1部", "2部", "3部", "4部"],
    rankingWords: ["順位表", "星取表", "戦績表", "standing", "standings", "table", "league"],
    negativeWords: ["要項", "日程", "ニュース", "PDF", "トーナメント"],
  },
  {
    key: "tochigi",
    prefecture: "栃木県",
    category: "U15",
    hostIncludes: ["tochigi-cy.com"],
    startUrl: "https://tochigi-cy.com/",
    leagueWords: ["1部", "2部", "3部", "4部"],
    rankingWords: ["順位表", "星取表", "戦績表", "standing", "standings", "table", "league"],
    negativeWords: ["要項", "日程", "ニュース", "PDF", "トーナメント"],
  },
  {
    key: "gunma",
    prefecture: "群馬県",
    category: "U15",
    hostIncludes: ["gunma-cy.com"],
    startUrl: "https://gunma-cy.com/",
    leagueWords: ["1部", "2部", "3部", "4部"],
    rankingWords: ["順位表", "星取表", "戦績表", "standing", "standings", "table", "league"],
    negativeWords: ["要項", "日程", "ニュース", "PDF", "トーナメント"],
  },
];

export function getLeagueSiteConfig(sourceUrl: string) {
  const url = String(sourceUrl || "").toLowerCase();

  return LEAGUE_SITE_CONFIGS.find((config) =>
    config.hostIncludes.some((host) => url.includes(host.toLowerCase()))
  ) || null;
}