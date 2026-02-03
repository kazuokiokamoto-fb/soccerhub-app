// app/chat/types.ts
export type ChatThread = {
  id: string;
  created_at: string;
  updated_at: string | null;
  kind: string | null; // "direct" など
};

export type ChatMember = {
  thread_id: string;
  team_id: string;
  user_id: string;
  role: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  sender_team_id: string | null;
  body: string;
  created_at: string;
};