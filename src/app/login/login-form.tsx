"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type SignInState } from "./actions";

const initial: SignInState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initial);

  // After a successful send, replace the form with a confirmation card
  // rather than a flash banner — calmer, fits the editorial tone.
  if (state.status === "sent") {
    return (
      <div className="text-center">
        <p className="font-serif italic text-2xl text-burgundy mb-3">
          Check your inbox.
        </p>
        <p className="text-sm text-ink-soft">
          A magic link is on its way to{" "}
          <span className="font-medium text-ink">{state.email}</span>.
          <br />
          Click it from the same browser to come back.
        </p>
        <p className="mt-6 text-xs text-ink-soft/80">
          Didn&rsquo;t arrive after a minute? Check spam, or{" "}
          <a href="/login" className="text-burgundy underline-offset-4 hover:underline">
            try again
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="you@example.com"
          defaultValue={state.email ?? ""}
        />
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-burgundy">{state.message}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full mt-2">
        {pending ? "Sending…" : "Send magic link"}
      </Button>
    </form>
  );
}
