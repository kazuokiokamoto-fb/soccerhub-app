export type SelectionEvent = {
  id: string;
  title: string;

  organization_name: string | null;
  organization_type: string | null;

  target_categories: string[];
  gender: "any" | "boys" | "girls";

  prefecture: string | null;
  city: string | null;
  area: string | null;

  venue_name: string | null;
  venue_address: string | null;

  event_date: string | null;
  event_start_time: string | null;
  event_end_time: string | null;

  application_start_date: string | null;
  application_deadline: string | null;

  fee_amount: number | null;
  fee_note: string | null;

  source_url: string;
  official_url: string | null;

  summary: string | null;
  description: string | null;
  memo: string | null;
  image_url: string | null;

  is_featured: boolean;
  display_status: string;
  days_until_deadline: number | null;

  fetched_at: string | null;

  created_at: string;
  updated_at: string;
};