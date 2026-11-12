"use client";

import Link from "next/link";

export default function HomeRegisterPrompt() {
  return (
    <section className="home-register" aria-labelledby="home-register-title">
      <h1 id="home-register-title" className="home-register-title">
        まずはチームを登録しましょう
      </h1>
      <div className="home-actions">
        <Link href="/teams/new" className="sh-btn sh-btn--primary">
          チームを登録する
        </Link>
        <Link href="/mypage" className="sm-quiet">
          マイページ
        </Link>
      </div>
    </section>
  );
}
