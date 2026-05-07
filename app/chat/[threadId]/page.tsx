"use client";

import React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import ChatScheduleModal from "./ChatScheduleModal";
import { useChatThread } from "./useChatThread";
import {
  formatBubbleTime,
  formatDateDivider,
  sameDate,
  isOptimisticMessageId,
  isDeletedForEveryone,
} from "./chat-thread.utils";
import {
  pageWrap,
  chatPanel,
  authLoadingBox,
  panelHeader,
  headerLeft,
  titleWrap,
  headerRight,
  threadTitle,
  threadSubTitle,
  notifyBadgeGranted,
  chatBody,
  messageList,
  notMemberBox,
  dateDividerWrap,
  dateDivider,
  bubbleRow,
  bubbleWrap,
  senderName,
  bubbleBase,
  bubbleMine,
  bubbleOther,
  bubbleSending,
  bubbleDeleted,
  bubbleActionable,
  bubbleText,
  bubbleMeta,
  bubbleMetaOther,
  bubbleMineRow,
  bubbleMetaSide,
  bubbleMetaTime,
  readStateText,
  inputArea,
  inputRow,
  textareaStyle,
  sendButton,
  inputHint,
  sendErrorText,
  sheetBackdrop,
  sheetWrap,
  sheetPanel,
  sheetButton,
  sheetDangerButton,
  sheetCancelButton,
} from "./chat-thread.styles";

function pickLine(body: string, labels: string[]) {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const label of labels) {
    const line = lines.find((l) => l.includes(label));
    if (!line) continue;

    const parts = line.split(/[:：]/);
    if (parts.length >= 2) {
      return parts.slice(1).join("：").trim();
    }
  }

  return "";
}

function parseMatchApplication(body?: string | null) {
  const text = body ?? "";

  const dateTimeMatch = text.match(
    /(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})[〜~\-–—ー−](\d{1,2}:\d{2})/
  );

  const categoryMatch =
    text.match(/🏷\s*([^\n]+)/) ||
    text.match(/カテゴリ\s*[:：]\s*([^\n]+)/);

  const strengthMatches = Array.from(text.matchAll(/強さ\s*[:：]\s*([A-ZＳＳSABC未設定]+)/g));
  const firstStrength = strengthMatches[0]?.[1] ?? "";

  return {
    date: dateTimeMatch?.[1] ?? "",
    startTime: dateTimeMatch?.[2] ?? "",
    endTime: dateTimeMatch?.[3] ?? "",
    opponentName: pickLine(text, ["申込チーム"]),
    wantedTeamName: pickLine(text, ["募集チーム"]),
    opponentUniform: pickLine(text, ["相手ユニ色", "ユニ色", "ユニフォーム"]),
    category: categoryMatch?.[1]?.trim() ?? "",
    strength: firstStrength,
  };
}

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (/^https?:\/\//.test(part)) {
          return (
            <a
              key={`${part}-${index}`}
              href={part}
              target="_blank"
              rel="noreferrer"
              style={messageLink}
            >
              {part}
            </a>
          );
        }

        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </>
  );
}

export default function ChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const searchParams = useSearchParams();

  const threadId = params?.threadId ?? "";
  const from = searchParams.get("from");
  const slotId = searchParams.get("slotId");
  const date = searchParams.get("date");
  const teamId = searchParams.get("teamId");

  const chat = useChatThread({
    threadId,
    query: {
      from,
      slotId,
      date,
      teamId,
    } as any,
  });

  React.useEffect(() => {
    const setChatViewportHeight = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--chat-vh", `${height}px`);
    };

    setChatViewportHeight();

    window.visualViewport?.addEventListener("resize", setChatViewportHeight);
    window.visualViewport?.addEventListener("scroll", setChatViewportHeight);
    window.addEventListener("resize", setChatViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener("resize", setChatViewportHeight);
      window.visualViewport?.removeEventListener("scroll", setChatViewportHeight);
      window.removeEventListener("resize", setChatViewportHeight);
    };
  }, []);  

  const latestMatchApplicationBody = React.useMemo(() => {
    const reversed = [...chat.visibleMessages].reverse();

    const found = reversed.find((m) => {
      const body = m.body ?? "";
      return body.includes("試合申込") || body.includes("申込チーム");
    });

    return found?.body ?? "";
  }, [chat.visibleMessages]);

  const parsedMatchApplication = React.useMemo(() => {
    return parseMatchApplication(latestMatchApplicationBody);
  }, [latestMatchApplicationBody]);

  const scheduleDefaultValues = React.useMemo(() => {
    return {
      ...chat.scheduleDefaults,
      date: parsedMatchApplication.date || chat.scheduleDefaults.date,
      startTime:
        parsedMatchApplication.startTime || chat.scheduleDefaults.startTime,
      endTime: parsedMatchApplication.endTime || chat.scheduleDefaults.endTime,
      venueName: chat.scheduleDefaults.venueName,
      note: chat.scheduleDefaults.note,
      opponentName: parsedMatchApplication.opponentName,
      opponentUniform: parsedMatchApplication.opponentUniform,
      category: parsedMatchApplication.category,
      strength: parsedMatchApplication.strength,
    };
  }, [chat.scheduleDefaults, parsedMatchApplication]);

  if (chat.authLoading) {
    return (
      <main style={pageWrap}>
        <section style={chatPanel}>
          <div style={authLoadingBox}>ログイン状態を確認中…</div>
        </section>
      </main>
    );
  }

  if (!chat.meId) {
    return (
      <main style={pageWrap}>
        <section style={chatPanel}>
          <div style={authLoadingBox}>
            <div style={{ textAlign: "center", lineHeight: 1.8 }}>
              このチャットを見るにはログインが必要です。
              <div style={{ marginTop: 12 }}>
                <Link
                  href={`/login?redirect=${encodeURIComponent(
                    chat.loginRedirectPath
                  )}`}
                  className="sh-btn sh-btn--primary"
                >
                  ログインする
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <section style={chatPanel}>
        <header style={panelHeader}>
          <div style={headerLeft}>
            <Link href={chat.backLink.href} className="sh-btn">
              {chat.backLink.label}
            </Link>

            <div style={titleWrap}>
              <div style={threadTitle}>
                {chat.otherTeamName || "チャット"}
              </div>
              <div style={threadSubTitle}>
                {chat.otherTeamCategory || "チャット"}
              </div>
            </div>
          </div>

          <div style={headerRight}>
            {chat.isMember && !chat.isTeamChat ? (
              <button
                type="button"
                className="sh-btn"
                onClick={() => chat.setScheduleModalOpen(true)}
                disabled={!chat.canCreateProposal}
              >
                {chat.creatingProposal ? "作成中…" : "予定を作る"}
              </button>
            ) : null}

            {chat.otherTeamId ? (
              <Link
                href={`/teams/${chat.otherTeamId}?from=chat-thread&threadId=${threadId}${
                  chat.carriedQueryString ? `&${chat.carriedQueryString}` : ""
                }`}
                className="sh-btn"
              >
                チーム詳細
              </Link>
            ) : null}

            {chat.notificationPermission === "granted" ? (
              <span style={notifyBadgeGranted}>通知ON</span>
            ) : chat.notificationPermission !== "unsupported" ? (
              <button
                type="button"
                className="sh-btn"
                onClick={chat.requestNotificationPermission}
              >
                通知をON
              </button>
            ) : null}
          </div>
        </header>

        <div ref={chat.chatBodyRef} style={chatBody}>
          {chat.showAttendanceButtons ? (
            <div style={attendanceBox}>
              <div style={attendanceTitle}>この予定の出欠</div>

              <div style={attendanceButtonRow}>
                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={() => void chat.updateAttendance("attend")}
                  disabled={chat.savingAttendance}
                >
                  参加
                </button>

                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => void chat.updateAttendance("maybe")}
                  disabled={chat.savingAttendance}
                >
                  未定
                </button>

                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => void chat.updateAttendance("absent")}
                  disabled={chat.savingAttendance}
                >
                  不参加
                </button>
              </div>

              <div style={attendanceCurrent}>
                現在の回答：{chat.myAttendanceLabel || "未回答"}
              </div>
            </div>
          ) : null}

          {chat.loading ? <p style={{ color: "#666" }}>読み込み中…</p> : null}

          {!chat.loading && !chat.isMember ? (
            <div style={notMemberBox}>
              このスレッドに参加していません。
              <div style={{ marginTop: 12 }}>
                <Link href={chat.backLink.href} className="sh-btn">
                  戻る
                </Link>
              </div>
            </div>
          ) : null}

          {!chat.loading && chat.isMember && chat.visibleMessages.length === 0 ? (
            <p style={{ color: "#666" }}>メッセージはまだありません</p>
          ) : null}

          <div style={messageList}>
            {chat.visibleMessages.map((m, i) => {
              const mine = m.sender_id === chat.meId;
              const optimistic = isOptimisticMessageId(m.id);
              const prev = i > 0 ? chat.visibleMessages[i - 1] : null;
              const showDate =
                !prev || !sameDate(prev.created_at, m.created_at);
              const deletedForEveryone = isDeletedForEveryone(m);
              const canAction = chat.canOpenActionSheet(m);
              const isRead = chat.isReadByOther({
                messageCreatedAt: m.created_at,
                otherLastReadAt: chat.otherLastReadAt,
              });

              return (
                <React.Fragment key={m.id}>
                  {showDate ? (
                    <div style={dateDividerWrap}>
                      <span style={dateDivider}>
                        {formatDateDivider(m.created_at)}
                      </span>
                    </div>
                  ) : null}

                  <div
                    style={{
                      ...bubbleRow,
                      justifyContent: mine ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        ...bubbleWrap,
                        alignItems: mine ? "flex-end" : "flex-start",
                      }}
                    >
                      {!mine ? (
                        <div style={senderName}>{chat.otherTeamName}</div>
                      ) : null}

                      {mine ? (
                        <div style={bubbleMineRow}>
                          <div style={bubbleMetaSide}>
                            {isRead && !optimistic && !chat.isTeamChat ? (
                              <span style={readStateText}>既読</span>
                            ) : null}

                            <span style={bubbleMetaTime}>
                              {optimistic
                                ? "送信中…"
                                : formatBubbleTime(m.created_at)}
                            </span>
                          </div>

                          <div
                            role={canAction ? "button" : undefined}
                            tabIndex={canAction ? 0 : -1}
                            onContextMenu={
                              canAction
                                ? (e) => {
                                    e.preventDefault();
                                    chat.setActionSheetMessageId(m.id);
                                  }
                                : undefined
                            }
                            onTouchStart={
                              canAction
                                ? () => chat.startLongPress(m.id)
                                : undefined
                            }
                            onTouchEnd={
                              canAction ? chat.clearLongPressTimer : undefined
                            }
                            onTouchMove={
                              canAction ? chat.clearLongPressTimer : undefined
                            }
                            onTouchCancel={
                              canAction ? chat.clearLongPressTimer : undefined
                            }
                            onMouseDown={
                              canAction
                                ? () => chat.startLongPress(m.id)
                                : undefined
                            }
                            onMouseUp={
                              canAction ? chat.clearLongPressTimer : undefined
                            }
                            onMouseLeave={
                              canAction ? chat.clearLongPressTimer : undefined
                            }
                            style={{
                              ...bubbleBase,
                              ...bubbleMine,
                              ...(optimistic ? bubbleSending : null),
                              ...(deletedForEveryone ? bubbleDeleted : null),
                              ...(canAction ? bubbleActionable : null),
                            }}
                          >
                            <div style={bubbleText}>
                              {deletedForEveryone ? (
                                "このメッセージは削除されました"
                              ) : (
                                <LinkifiedText text={m.body ?? ""} />
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            style={{
                              ...bubbleBase,
                              ...bubbleOther,
                              ...(optimistic ? bubbleSending : null),
                              ...(deletedForEveryone ? bubbleDeleted : null),
                            }}
                          >
                            <div style={bubbleText}>
                              {deletedForEveryone ? (
                                "このメッセージは削除されました"
                              ) : (
                                <LinkifiedText text={m.body ?? ""} />
                              )}
                            </div>
                          </div>

                          <div style={{ ...bubbleMeta, ...bubbleMetaOther }}>
                            <span>
                              {optimistic
                                ? "送信中…"
                                : formatBubbleTime(m.created_at)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            <div ref={chat.bottomRef} />
          </div>
        </div>

        <div style={inputArea}>
          {chat.sendError ? (
            <div style={sendErrorText}>送信エラー: {chat.sendError}</div>
          ) : null}

          <div style={inputRow}>
            <textarea
              value={chat.text}
              onChange={(e) => chat.setText(e.target.value)}
              onKeyDown={chat.onKeyDown}
              placeholder="メッセージを入力"
              style={textareaStyle}
              disabled={!chat.meId || !chat.isMember || chat.sending}
            />

            <button
              className="sh-btn sh-btn--primary"
              type="button"
              onClick={() => void chat.send()}
              disabled={!chat.canSend}
              style={sendButton}
            >
              送信
            </button>
          </div>

          <div style={inputHint}>
            Enterで改行 / Ctrl+Enter または Cmd+Enter で送信
          </div>
        </div>
      </section>

      {chat.actionSheetMessageId ? (
        <>
          <div
            style={sheetBackdrop}
            onClick={() => chat.setActionSheetMessageId("")}
          />

          <div style={sheetWrap}>
            <div style={sheetPanel}>
              <button
                type="button"
                style={sheetDangerButton}
                onClick={() =>
                  void chat.deleteForEveryone(chat.actionSheetMessageId)
                }
                disabled={!!chat.deletingMessageId}
              >
                {chat.deletingMessageId === chat.actionSheetMessageId
                  ? "処理中…"
                  : "送信取消（全員）"}
              </button>

              <button
                type="button"
                style={sheetButton}
                onClick={() => void chat.deleteForMe(chat.actionSheetMessageId)}
                disabled={!!chat.deletingMessageId}
              >
                {chat.deletingMessageId === chat.actionSheetMessageId
                  ? "処理中…"
                  : "自分だけ削除"}
              </button>

              <button
                type="button"
                style={sheetCancelButton}
                onClick={() => chat.setActionSheetMessageId("")}
                disabled={!!chat.deletingMessageId}
              >
                キャンセル
              </button>
            </div>
          </div>
        </>
      ) : null}

      {!chat.isTeamChat ? (
        <ChatScheduleModal
          open={chat.scheduleModalOpen}
          onClose={() => chat.setScheduleModalOpen(false)}
          loading={chat.creatingProposal}
          defaultValues={scheduleDefaultValues as any}
          teamId={chat.myTeamId}
          onSubmit={(values) => void chat.createScheduleProposal(values)}
        />
      ) : null}
    </main>
  );
}

const attendanceBox: React.CSSProperties = {
  margin: "0 0 12px",
  padding: 12,
  borderRadius: 14,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
};

const attendanceTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#16391f",
  marginBottom: 8,
};

const attendanceButtonRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const attendanceCurrent: React.CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  color: "#3b6a49",
  fontWeight: 800,
};

const messageLink: React.CSSProperties = {
  color: "#145c2a",
  fontWeight: 900,
  textDecoration: "underline",
  wordBreak: "break-all",
};