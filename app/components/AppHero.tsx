"use client";

export default function AppHero(props: {
  icon: string;
  title: string;
  desc: string;
}) {
  const { icon, title, desc } = props;

  return (
    <header className="sm-page-head">
      <h1 className="sm-title">
        {icon ? <span className="sm-hero-icon" aria-hidden="true">{icon}</span> : null}
        {title}
      </h1>
      {desc ? <p className="sm-meta">{desc}</p> : null}
    </header>
  );
}
