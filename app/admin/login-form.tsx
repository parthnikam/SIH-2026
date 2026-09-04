"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "@/app/admin/actions";

const initialState: LoginState = { error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d94361] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#c73755] disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : null}
      {pending ? "Signing in…" : "Sign in to dashboard"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label
          htmlFor="username"
          className="mb-2 block text-[11px] font-semibold tracking-[0.14em] text-[#9c5f6d] uppercase"
        >
          Username
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#c1848e]">
            <UserIcon />
          </span>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            autoFocus
            placeholder="Enter your username"
            className="h-12 w-full rounded-xl border border-[#efcfd1] bg-[#fffdfb] pl-11 pr-4 text-sm text-[#6f2c3d] outline-none transition-colors placeholder:text-[#c58e97] focus:border-[#d94361]"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-2 block text-[11px] font-semibold tracking-[0.14em] text-[#9c5f6d] uppercase"
        >
          Password
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#c1848e]">
            <LockIcon />
          </span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            aria-describedby={state.error ? "login-error" : undefined}
            className="h-12 w-full rounded-xl border border-[#efcfd1] bg-[#fffdfb] pl-11 pr-4 text-sm text-[#6f2c3d] outline-none transition-colors placeholder:text-[#c58e97] focus:border-[#d94361]"
          />
        </div>
      </div>

      {state.error ? (
        <p
          id="login-error"
          role="alert"
          className="rounded-lg border border-[#efbdc5] bg-[#fff0f2] px-3 py-2.5 text-sm text-[#a63c54]"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a2 2 0 0 1 2 2v8H4v-8a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
