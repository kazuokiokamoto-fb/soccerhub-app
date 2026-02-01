// app/teams/page.tsx
import { Suspense } from "react";
import TeamsClient from "./TeamsClient";

type Props = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default function TeamsPage(props: Props) {
  const created =
    typeof props.searchParams?.created === "string"
      ? props.searchParams?.created
      : "";

  return (
    <Suspense fallback={<main style={{ padding: 24 }}>読み込み中...</main>}>
      <TeamsClient createdId={created} />
    </Suspense>
  );
}