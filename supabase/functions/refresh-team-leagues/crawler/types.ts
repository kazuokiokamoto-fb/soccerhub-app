export type TeamRow = {
  teamName: string;
};

export type LeagueTable = {
  leagueName: string;
  teams: TeamRow[];
};

export type LeagueConfig = {
  prefecture: string;
  category: string;
  leagueName: string;
  leagueRank: number;
  sourceUrl: string;
};

export type CrawlResult = {
  teams: TeamRow[];
};