import type { Metadata } from "next";
import { Board } from "@/components/board/board";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ country?: string; pump?: string }> }) {
  await requireUser("/board");
  const { country, pump } = await searchParams;
  return <Board initialCountry={country === "uganda" ? "uganda" : "sierra_leone"} initialPump={pump} />;
}
