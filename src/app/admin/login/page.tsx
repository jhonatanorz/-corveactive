"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fbf8f4] text-[#211d1a]">
      <form action={formAction} className="w-80 space-y-3 p-6">
        <h1 className="tracking-[0.28em] text-center text-lg">C O R V E</h1>
        <p className="text-center text-sm text-[#8a7d70]">Panel de administración</p>
        <input name="email" type="email" required placeholder="Correo"
          className="w-full rounded-lg border border-[#d8cdc0] p-3 text-sm" />
        <input name="password" type="password" required placeholder="Contraseña"
          className="w-full rounded-lg border border-[#d8cdc0] p-3 text-sm" />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending}
          className="w-full rounded-lg bg-[#211d1a] p-3 text-sm text-white disabled:opacity-60">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
