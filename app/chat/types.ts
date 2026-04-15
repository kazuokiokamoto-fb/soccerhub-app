// app/chat/types.ts

export type ChatThread = {
  id: string;
  created_at: string;
  updated_at: string | null;
};

export type ChatMember = {
  thread_id: string;
  team_id: string;
  user_id: string;
  role: string | null;
  created_at: string;
  last_read_at: string | null;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_team_id: string | null;
  body: string;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by_sender?: boolean;
  deleted_for_everyone?: boolean;
};