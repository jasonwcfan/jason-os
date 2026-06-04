"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </div>
      {state.error && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Unlocking…" : "Unlock"}
      </button>
    </form>
  );
}
