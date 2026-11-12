"use client";

export function MorePanel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="sm-more">
      <summary>{label}</summary>
      <div className="sm-more-body">{children}</div>
    </details>
  );
}
