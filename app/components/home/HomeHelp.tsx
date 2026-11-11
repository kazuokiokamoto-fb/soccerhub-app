"use client";

import { useState, type ReactNode } from "react";

function Fold({
  title,
  panelId,
  open,
  onToggle,
  children,
}: {
  title: string;
  panelId: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="home-fold">
      <h2 className="home-fold-heading">
        <button
          type="button"
          className="home-fold-button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{title}</span>
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      </h2>
      {open ? (
        <div id={panelId} className="home-fold-body">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export default function HomeHelp({
  guideInitiallyOpen,
}: {
  guideInitiallyOpen: boolean;
}) {
  const [guideOpen, setGuideOpen] = useState(guideInitiallyOpen);
  const [qaOpen, setQaOpen] = useState(false);

  return (
    <>
      <Fold
        title="使い方"
        panelId="home-guide"
        open={guideOpen}
        onToggle={() => setGuideOpen((value) => !value)}
      >
        <ol className="home-steps">
          <li>
            <p className="home-step-title">ログインしてチームを登録する</p>
            <p className="home-step-text">
              アカウントを作り、チーム名や活動エリアを登録します。
            </p>
          </li>
          <li>
            <p className="home-step-title">練習試合を探すか、募集を出す</p>
            <p className="home-step-text">
              条件に合う相手を探すか、自分たちの日程で募集を出せます。
            </p>
          </li>
          <li>
            <p className="home-step-title">チャットで日程を調整する</p>
            <p className="home-step-text">
              申し込みのあと、チャットで日時や場所を決めます。
            </p>
          </li>
        </ol>
      </Fold>

      <Fold
        title="Q&A"
        panelId="home-qa"
        open={qaOpen}
        onToggle={() => setQaOpen((value) => !value)}
      >
        <div className="home-qa">
          <p className="home-qa-q">Q. まず何をすればいいですか？</p>
          <p className="home-qa-a">
            A. ログインしてチームを登録してください。登録すると、練習試合の募集や申込ができます。
          </p>
        </div>
        <div className="home-qa">
          <p className="home-qa-q">Q. 相手チームにすぐ連絡できますか？</p>
          <p className="home-qa-a">
            A. 募集に申し込むと、チャットで日程や詳細を調整できます。
          </p>
        </div>
        <div className="home-qa">
          <p className="home-qa-q">Q. 試合を探すのはどこですか？</p>
          <p className="home-qa-a">
            A. ホームの「練習試合を探す」から探せます。エリアやカテゴリで絞り込めます。
          </p>
        </div>
        <div className="home-qa">
          <p className="home-qa-q">Q. 試合を募集するには？</p>
          <p className="home-qa-a">
            A. ホームの「試合を募集する」から、日付と条件を入れて募集を作れます。
          </p>
        </div>
        <div className="home-qa">
          <p className="home-qa-q">Q. 「強さ」はどう選べばいいですか？</p>
          <p className="home-qa-a">
            A. 練習試合の相手を探しやすくするための目安です。勝敗を保証するものではありません。
            <br />
            <br />
            <b>SS</b>：都・県リーグ1・2部相当。試合強度は非常に高く、公式戦同等の緊張感を求めるチーム向け。
            <br />
            <b>S</b>：都・県リーグ3・4部相当。基礎技術が安定し、しっかり競り合える相手を求めるチーム向け。
            <br />
            <b>A</b>：地域リーグ1・2部相当。育成と競争のバランスを重視するチーム向け。
            <br />
            <b>B</b>：地域リーグ3・4部相当。試合経験を積みながら成長したいチーム向け。
            <br />
            <b>C</b>：フレンドリー。交流・経験重視で、勝敗よりも楽しく真剣に試合したいチーム向け。
          </p>
        </div>
        <div className="home-qa">
          <p className="home-qa-q">Q. お問い合わせはどこですか？</p>
          <p className="home-qa-a">A. 下のメールアドレスからご連絡ください。</p>
        </div>
      </Fold>
    </>
  );
}
