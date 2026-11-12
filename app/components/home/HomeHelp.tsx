"use client";

import { useState, type ReactNode } from "react";
import { STRENGTH_GUIDES } from "@/app/match/constants/strengthGuides";

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
            <p className="home-step-title"><span className="home-step-no">1</span>ログインしてチームを登録する</p>
          </li>
          <li>
            <p className="home-step-title"><span className="home-step-no">2</span>練習試合を探すか、募集を出す</p>
          </li>
          <li>
            <p className="home-step-title"><span className="home-step-no">3</span>チャットで日程を調整する</p>
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
            {STRENGTH_GUIDES.map((guide) => (
              <span key={guide.rank}>
                <b>{guide.rank}</b>：{guide.short}。{guide.note}
                <br />
              </span>
            ))}
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
