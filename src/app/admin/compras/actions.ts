"use server";
import { redirect } from "next/navigation";
import { createDraftPO } from "@/lib/repos/purchasing";

export async function newOrder(): Promise<void> {
  const id = await createDraftPO();
  redirect(`/admin/compras/${id}`);
}
