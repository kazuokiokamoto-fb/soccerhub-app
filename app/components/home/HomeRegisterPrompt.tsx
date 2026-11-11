"use client";

import Link from "next/link";

export default function HomeRegisterPrompt() {
  return (
    <section className="home-register" aria-labelledby="home-register-title">
      <h1 id="home-register-title" className="home-register-title">
        まずはチームを登録しましょう
      </h1>
      <p className="home-register-text">
        チームを登録すると、練習試合の募集や申込、チャットでの調整ができるようになります。
      </p>
      <div className="home-actions">
        <Link href="/teams/new" className="sh-btn sh-btn--primary">
          チームを登録する
        </Link>
        <Link href="/mypage" className="sh-btn">
          マイページへ
        </Link>
      </div>
    </section>
  );
}
