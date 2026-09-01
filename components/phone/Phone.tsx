"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGeminiCall } from "./useGeminiCall";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.3 1.1L6.6 10.8z" />
    </svg>
  );
}

export function Phone() {
  const router = useRouter();
  const call = useGeminiCall();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (call.status === "ended" && call.interviewId) {
      const t = window.setTimeout(() => {
        router.push(`/interview/${call.interviewId}`);
      }, 1200);
      return () => window.clearTimeout(t);
    }
  }, [call.status, call.interviewId, router]);

  const lastUser = [...call.captions].reverse().find((c) => c.role === "user");
  const lastAgent = [...call.captions].reverse().find((c) => c.role === "agent");
  const inCall = call.status === "connecting" || call.status === "live";

  return (
    <div className="flex w-full max-w-[360px] flex-col items-center gap-6">
      <div className="flex min-h-[640px] w-full flex-col rounded-[40px] border-[10px] border-zinc-900 bg-zinc-950 text-zinc-50">
        <div className="flex items-center justify-center pt-4">
          <div className="h-5 w-24 rounded-full bg-zinc-900" />
        </div>

        <div className="flex flex-1 flex-col px-6 pb-8 pt-8">
          <p className="text-center text-xs tracking-[0.2em] text-zinc-400 uppercase">
            PM-AJAY
          </p>
          <h1 className="mt-2 text-center text-xl font-medium">
            Livelihood Helpline
          </h1>

          {call.status === "idle" || call.status === "error" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-6">
              <p className="max-w-[16rem] text-center text-sm leading-6 text-zinc-400">
                Speak in any language. We will answer in the same way.
              </p>
              {call.error ? (
                <p className="text-center text-sm text-red-400">{call.error}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void call.startCall()}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-white"
                aria-label="Start call"
              >
                <PhoneIcon className="h-8 w-8" />
              </button>
              <span className="text-sm text-zinc-400">Call</span>
            </div>
          ) : null}

          {inCall ? (
            <div className="flex flex-1 flex-col">
              <p className="mt-4 text-center font-mono text-2xl tabular-nums">
                {call.status === "connecting" ? "Connecting" : formatTime(call.elapsed)}
              </p>
              <div className="mt-8 flex flex-1 flex-col justify-end gap-4">
                <div className="min-h-[4.5rem]">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">You</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-200">
                    {lastUser?.text || (call.muted ? "Muted" : "Listening…")}
                  </p>
                </div>
                <div className="min-h-[4.5rem]">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Helpline</p>
                  <p className="mt-1 text-sm leading-6 text-zinc-200">
                    {lastAgent?.text || (call.status === "connecting" ? "Please wait…" : "…")}
                  </p>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-center gap-8">
                <button
                  type="button"
                  onClick={call.toggleMute}
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-sm ${
                    call.muted ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-50"
                  }`}
                >
                  {call.muted ? "Unmute" : "Mute"}
                </button>
                <button
                  type="button"
                  onClick={() => void call.hangUp()}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600"
                  aria-label="Hang up"
                >
                  <PhoneIcon className="h-7 w-7 rotate-[135deg]" />
                </button>
              </div>
              {call.micDenied ? (
                <form
                  className="mt-6 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    call.sendText(draft);
                    setDraft("");
                  }}
                >
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type instead"
                    className="min-w-0 flex-1 rounded-none border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-50 outline-none"
                  />
                  <button
                    type="submit"
                    className="border border-zinc-100 bg-zinc-100 px-3 py-2 text-sm text-zinc-900"
                  >
                    Send
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}

          {call.status === "ended" ? (
            <div className="flex flex-1 flex-col items-center justify-center">
              <p className="text-lg">Call ended</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
