"use client";

import { useEffect } from "react";
import AppTabNav from "@/app/components/AppTabNav";
import { IconChat, IconPlus, IconSearch } from "@/app/components/ui/Icons";
import { MorePanel } from "@/app/components/ui/MorePanel";

function useZone(zone: "hub" | "selection") {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.zone;
    root.dataset.zone = zone;
    return () => {
      if (previous) root.dataset.zone = previous;
    };
  }, [zone]);
}

export default function LoggedInMocks({ screen }: { screen: string }) {
  useZone(screen.startsWith("selection") ? "selection" : "hub");

  return (
    <main className="sm-screen">
      <AppTabNav />
      {screen === "chat" ? <ChatMock /> : null}
      {screen === "mypage" ? <MyPageMock /> : null}
      {screen === "match" ? <MatchMock /> : null}
      {screen === "team" ? <TeamMock /> : null}
      {screen === "selection" ? <SelectionMock /> : null}
      {screen === "selection-detail" ? <SelectionDetailMock /> : null}
      {screen === "home-in" ? <HomeInMock /> : null}
      {screen === "recruit" ? <RecruitMock /> : null}
    </main>
  );
}

function ChatMock() {
  return (
    <>
      <h1 className="sm-title">チャット</h1>
      <div className="sm-seg" role="group" aria-label="チャットの種類">
        <button type="button" aria-pressed="true">自チーム 1</button>
        <button type="button">他チーム</button>
      </div>
      <div className="sm-list">
        <a className="sm-row" href="#team">
          <span className="sm-avatar">青</span>
          <span>
            <span className="sm-chip-row">
              <strong className="sm-row-title">青葉FC</strong>
              <span className="status-chip status-chip--late">未読</span>
            </span>
            <span className="sm-meta">日曜の会場、こちらで大丈夫です</span>
          </span>
        </a>
        <a className="sm-row" href="#other">
          <span className="sm-avatar">駒</span>
          <span>
            <strong className="sm-row-title">駒沢SC</strong>
            <span className="sm-meta">まだメッセージがありません</span>
          </span>
        </a>
      </div>
    </>
  );
}

function MyPageMock() {
  return (
    <>
      <h1 className="sm-title">マイページ</h1>
      <section className="sm-card sm-stack">
        <span className="status-chip status-chip--ok">ログイン中</span>
        <p className="sm-key" style={{ fontSize: 22 }}>青葉FC</p>
        <a className="sh-btn sh-btn--primary" href="#account">アカウント</a>
      </section>
      <section className="sm-card sm-stack">
        <div className="sm-chip-row">
          <span className="status-chip status-chip--ok">管理者</span>
          <span className="sm-chip sm-chip--static">U-12</span>
          <span className="status-chip status-chip--ok">グラウンド</span>
        </div>
        <h2 className="sm-key">青葉FC</h2>
        <p className="sm-stat" style={{ justifySelf: "start" }}>
          <strong>A</strong>
          <span>東京都 世田谷</span>
        </p>
        <a className="sh-btn sh-btn--primary" href="#team">詳細</a>
        <MorePanel label="その他">
          <a className="sh-btn" href="#aff">所属</a>
          <a className="sh-btn" href="#report">年次報告</a>
          <button type="button" className="sh-btn sh-btn--danger">削除</button>
        </MorePanel>
      </section>
    </>
  );
}

function MatchMock() {
  return (
    <>
      <section className="sm-card sm-stack">
        <div className="sm-stat-row">
          <p className="sm-stat"><strong>12</strong><span>チーム</span></p>
          <p className="sm-stat"><strong>4</strong><span>試合</span></p>
        </div>
        <p className="sm-meta">東京都 / U-12</p>
        <button type="button" className="sh-btn">チーム一覧</button>
        <button type="button" className="sm-quiet">条件</button>
      </section>
      <section className="sm-card sm-stack">
        <p className="sm-key">11/15（日）</p>
        <span className="status-chip status-chip--ok">募集 2</span>
        <article className="sm-stack">
          <strong className="sm-row-title">青葉FC</strong>
          <span className="sm-meta">9:00–11:00 · 世田谷</span>
        </article>
        <button type="button" className="sh-btn sh-btn--primary">募集する</button>
      </section>
    </>
  );
}

function TeamMock() {
  return (
    <section className="sm-card sm-stack">
      <div className="sm-chip-row">
        <span className="sm-chip sm-chip--static">U-12</span>
        <span className="status-chip status-chip--ok">自分のチーム</span>
      </div>
      <h1 className="sm-key">青葉FC</h1>
      <p className="sm-stat" style={{ justifySelf: "start" }}>
        <strong>A</strong>
        <span>都・県リーグ1・2部</span>
      </p>
      <p className="sm-meta">東京都 世田谷 · 18人</p>
      <a className="sh-btn sh-btn--primary" href="#edit">チーム編集</a>
      <MorePanel label="調べる">
        <button type="button" className="sh-btn">Gemini</button>
      </MorePanel>
    </section>
  );
}

function SelectionMock() {
  return (
    <>
      <h1 className="sm-title">セレクション</h1>
      <div className="sm-stat-row">
        <p className="sm-stat"><strong>48</strong><span>掲載</span></p>
        <p className="sm-stat"><strong>3</strong><span>7日の新着</span></p>
      </div>
      <section className="sm-card sm-stack">
        <div className="chip-grid">
          <button type="button" aria-pressed="true">U-12</button>
          <button type="button">U-15</button>
          <button type="button">女子</button>
        </div>
        <details className="sm-more">
          <summary>条件・通知</summary>
          <div className="sm-more-body">
            <button type="button" className="sh-btn sh-btn--primary">この条件で通知</button>
          </div>
        </details>
      </section>
      <article className="sm-card sm-stack">
        <div className="sm-chip-row">
          <span className="status-chip status-chip--ok">募集中</span>
          <span className="status-chip status-chip--late">NEW</span>
        </div>
        <h2 className="sm-row-title">FC東京 U-12 セレクション</h2>
        <p className="sm-key">11/22</p>
        <p className="sm-meta">東京都 調布</p>
      </article>
    </>
  );
}

function SelectionDetailMock() {
  return (
    <>
      <div className="sm-top-links">
        <a className="sm-quiet" href="#list">一覧</a>
        <a className="sm-back-site" href="#hub">サカまっち</a>
      </div>
      <section className="sm-card sm-stack">
        <span className="status-chip status-chip--ok">募集中</span>
        <h1 className="sm-title">FC東京 U-12</h1>
        <p className="sm-meta">FC東京</p>
        <div className="sm-stat-row">
          <p className="sm-stat"><strong>11/22</strong><span>開催日</span></p>
          <p className="sm-stat"><strong>調布</strong><span>地域</span></p>
        </div>
        <a className="sh-btn sh-btn--primary" href="#official">公式サイト</a>
      </section>
    </>
  );
}

function RecruitMock() {
  return (
    <>
      <h1 className="sm-title">募集する</h1>
      <section className="sm-card sm-stack">
        <label className="sm-stack">
          <span className="sm-meta">ホストチーム</span>
          <strong className="sm-row-title">青葉FC</strong>
        </label>
        <div className="sm-stat-row">
          <p className="sm-stat"><strong style={{ fontSize: 22 }}>11/15</strong><span>日付</span></p>
          <p className="sm-stat"><strong style={{ fontSize: 22 }}>13:00</strong><span>開始</span></p>
        </div>
        <p className="sm-meta">終了 15:00 · 世田谷区 三宿</p>
        <div>
          <p className="sm-meta">カテゴリ</p>
          <div className="chip-grid">
            <button type="button" aria-pressed="true">U-12</button>
            <button type="button">U-15</button>
            <button type="button">一般</button>
          </div>
        </div>
        <div className="sm-chip-row">
          <span className="sm-chip sm-chip--static">強さ 指定なし</span>
          <span className="sm-chip sm-chip--static">既存グラウンド</span>
        </div>
        <button type="button" className="sh-btn sh-btn--primary">募集する</button>
        <a className="sm-quiet" href="#cancel">キャンセル</a>
      </section>
    </>
  );
}

function HomeInMock() {
  return (
    <>
      <section className="sm-card sm-stack">
        <span className="status-chip status-chip--late">期限切れ 2026/5/31・提出できます</span>
        <p className="sm-key" style={{ fontSize: 24 }}>青葉FC</p>
        <a className="sh-btn sh-btn--primary" href="#report">報告を開く</a>
      </section>
      <section className="sm-card sm-stack">
        <h2 className="sm-row-title">マイスケジュール</h2>
        <span className="status-chip status-chip--ok">11/15（日）</span>
        <p className="sm-key" style={{ fontSize: 22 }}>9:00–11:00</p>
        <p className="sm-meta">駒沢SC · ホスト</p>
      </section>
      <div className="home-big-row">
        <a className="home-big" href="#search"><span className="home-big-icon"><IconSearch size={28} /></span>探す</a>
        <a className="home-big" href="#new"><span className="home-big-icon"><IconPlus size={28} /></span>募集</a>
        <a className="home-big" href="#chat"><span className="home-big-icon"><IconChat size={28} /></span>チャット</a>
      </div>
    </>
  );
}
