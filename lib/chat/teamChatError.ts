function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : "";
  }
  return "";
}

export function teamChatOpenErrorMessage(error: unknown): string {
  const message = errorMessage(error);

  if (/not a member of team/i.test(message)) {
    return "このチームのメンバーだけがチームチャットを開けます。";
  }

  if (/not authenticated/i.test(message)) {
    return "ログインが必要です。";
  }

  return "しばらくしてから、もう一度お試しください。";
}
