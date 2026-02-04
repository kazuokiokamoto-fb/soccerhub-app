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

  // ✅ 未読管理：このスレッドを最後に読んだ時刻（NULLなら未読扱いにできる）
  last_read_at: string | null;
};

export type ChatMessage = {
  id: string;
  thread_id: string;

  // ✅ ここを DB に合わせて統一（sender_user_id -> sender_id）
  sender_id: string;

  sender_team_id: string | null;
  body: string;
  created_at: string;
};