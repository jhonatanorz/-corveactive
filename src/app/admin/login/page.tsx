"use client";

import { useActionState } from "react";
import { Button, Card, Wordmark, inputClass, Isotype } from "@/components/ui";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  return (
    <main className="min-h-screen flex items-center justify-center bg-snow text-ink relative overflow-hidden">
      <Isotype className="absolute -top-24 -left-16 w-[26rem] h-[26rem] text-periwinkle/45 blur-[1px] -rotate-12" />
      <Card className="w-80 p-6 relative">
        <form action={formAction} className="space-y-3">
          <Wordmark href="/admin/pedidos" className="block text-center text-2xl" />
          <p className="text-center text-sm text-ink-3">Panel de administración</p>
          <input name="email" type="email" required placeholder="Correo" className={inputClass} />
          <input name="password" type="password" required placeholder="Contraseña" className={inputClass} />
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
