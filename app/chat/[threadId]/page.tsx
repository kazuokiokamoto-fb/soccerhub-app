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

export default function ChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const searchParams = useSearchParams();

  const threadId = params?.threadId ?? "";
  const from = searchParams.get("from");
  const slotId = searchParams.get("slotId");
  const date = searchParams.get("date");

  const chat = useChatThread({
    threadId,
    from,
    slotId,
    date,
  });

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
              <div style={threadTitle}>{chat.otherTeamName}</div>
              <div style={threadSubTitle}>
                {chat.otherTeamCategory || "チャット"}
              </div>
            </div>
          </div>

          <div style={headerRight}>
            {chat.isMember ? (
              <button
                type="button"
                className="sh-btn"
                onClick={() => chat.setScheduleModalOpen(true)}
                disabled={!chat.canCreateProposal}
              >
                予定を作る
              </button>
            ) : null}

            {chat.otherTeamId ? (
              <Link
                href={`/teams/${chat.otherTeamId}${
                  chat.carriedQueryString ? `?${chat.carriedQueryString}` : ""
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
                            {isRead && !optimistic ? (
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
                              {deletedForEveryone
                                ? "このメッセージは削除されました"
                                : m.body}
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
                              {deletedForEveryone
                                ? "このメッセージは削除されました"
                                : m.body}
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
              onFocus={() => {
                setTimeout(() => {
                  chat.scrollToBottom(false);
                }, 120);
              }}
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

      <ChatScheduleModal
        open={chat.scheduleModalOpen}
        onClose={() => chat.setScheduleModalOpen(false)}
        loading={chat.creatingProposal}
        defaultValues={chat.scheduleDefaults}
        onSubmit={(values) => void chat.createScheduleProposal(values)}
      />
    </main>
  );
}