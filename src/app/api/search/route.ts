import { NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/repos/catalog";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const items = await searchSuggestions(q);
  return NextResponse.json({ items });
}
