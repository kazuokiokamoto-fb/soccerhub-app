export type SelectionSource = {
  id: string;
  name: string;
  base_url: string;
  organization_type: string;
  source_rank: string | null;
  enabled: boolean;
};

export type CandidatePage = {
  pageUrl: string;
  pageTitle: string;
  rawText: string;
  html: string;
  status: number;
  contentType: string;
  pdf: boolean;
  priority: number;
  reason: string;
};

export type QueueItem = {
  url: string;
  external: boolean;
  depth: number;
  fromUrl?: string | null;
};