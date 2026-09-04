"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, type Session } from "@google/genai";
import { liveConnectConfig, LIVE_MODEL } from "@/lib/live/config";
import { readJson } from "@/lib/http/readJson";
import {
  base64ToInt16,
  downsampleTo16k,
  int16ToBase64,
  PcmPlayer,
} from "./audio";

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";

export type Caption = { role: "user" | "agent"; text: string };

export function useGeminiCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const sessionRef = useRef<Session | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(false);
  const transcriptRef = useRef<Caption[]>([]);
  const interviewIdRef = useRef<string | null>(null);
  const userBuf = useRef("");
  const agentBuf = useRef("");
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const pushCaption = useCallback((role: "user" | "agent", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next: Caption = { role, text: trimmed };
    transcriptRef.current = [...transcriptRef.current, next];
    setCaptions(transcriptRef.current);
  }, []);

  const flushPartial = useCallback(
    (role: "user" | "agent") => {
      if (role === "user" && userBuf.current) {
        pushCaption("user", userBuf.current);
        userBuf.current = "";
      }
      if (role === "agent" && agentBuf.current) {
        pushCaption("agent", agentBuf.current);
        agentBuf.current = "";
      }
    },
    [pushCaption],
  );

  const hangUp = useCallback(async () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    flushPartial("user");
    flushPartial("agent");

    const id = interviewIdRef.current;
    const transcript = transcriptRef.current;
    if (id) {
      try {
        await fetch("/api/interviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            status: "completed",
            transcript,
          }),
        });
      } catch {
        /* hang up anyway */
      }
    }

    try {
      sessionRef.current?.close();
    } catch {
      /* closed */
    }
    sessionRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (captureCtxRef.current) {
      await captureCtxRef.current.close();
      captureCtxRef.current = null;
    }
    if (playerRef.current) {
      await playerRef.current.close();
      playerRef.current = null;
    }

    setStatus((s) => (s === "idle" ? s : "ended"));
  }, [flushPartial]);

  const startCall = useCallback(async () => {
    setError(null);
    setCaptions([]);
    transcriptRef.current = [];
    userBuf.current = "";
    agentBuf.current = "";
    setElapsed(0);
    setMuted(false);
    mutedRef.current = false;
    setStatus("connecting");

    try {
      const tokenRes = await fetch("/api/live/token", { method: "POST" });
      const tokenBody = await readJson<{
        token?: string;
        interviewId?: string;
        error?: string;
      }>(tokenRes);
      if (!tokenRes.ok || !tokenBody.token || !tokenBody.interviewId) {
        throw new Error(tokenBody.error || "Could not start the call.");
      }
      setInterviewId(tokenBody.interviewId);
      interviewIdRef.current = tokenBody.interviewId;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        setMicDenied(true);
        throw new Error("Microphone permission is needed to talk.");
      }
      streamRef.current = stream;

      const player = new PcmPlayer();
      await player.start();
      playerRef.current = player;

      const ai = new GoogleGenAI({
        apiKey: tokenBody.token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: liveConnectConfig(),
        callbacks: {
          onopen: () => {
            setStatus("live");
            startedAtRef.current = Date.now();
            timerRef.current = window.setInterval(() => {
              setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
            }, 1000);
          },
          onmessage: (message) => {
            const content = message.serverContent;
            if (content?.interrupted) {
              player.interrupt();
            }
            if (content?.inputTranscription?.text) {
              userBuf.current += content.inputTranscription.text;
            }
            if (content?.outputTranscription?.text) {
              agentBuf.current += content.outputTranscription.text;
            }
            if (content?.turnComplete) {
              flushPartial("user");
              flushPartial("agent");
            }
            if (content?.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData?.data) {
                  player.enqueue(base64ToInt16(part.inlineData.data));
                }
              }
            }

            const calls = message.toolCall?.functionCalls;
            if (calls?.length) {
              void (async () => {
                const functionResponses = [];
                for (const fc of calls) {
                  const res = await fetch("/api/tools", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: fc.name,
                      args: (fc.args ?? {}) as Record<string, unknown>,
                      interviewId: interviewIdRef.current,
                    }),
                  });
                  const json = await readJson<Record<string, unknown>>(res);
                  functionResponses.push({
                    id: fc.id,
                    name: fc.name,
                    response: json,
                  });
                }
                session.sendToolResponse({ functionResponses });
              })();
            }
          },
          onerror: (e) => {
            setError(e.message || "Call error");
            setStatus("error");
          },
          onclose: () => {
            /* hangUp sets ended */
          },
        },
      });

      sessionRef.current = session;
      session.sendRealtimeInput({
        text: "The beneficiary just answered the phone. Greet them respectfully and begin the counselling interview.",
      });

      const capture = new AudioContext();
      captureCtxRef.current = capture;
      await capture.audioWorklet.addModule("/pcm-processor.js");
      const source = capture.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(capture, "pcm-processor");
      node.port.onmessage = (event) => {
        if (mutedRef.current || !sessionRef.current) return;
        const frame = event.data as Float32Array;
        const pcm = downsampleTo16k(frame, capture.sampleRate);
        sessionRef.current.sendRealtimeInput({
          audio: {
            data: int16ToBase64(pcm),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      };
      source.connect(node);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not start the call.";
      setError(message);
      setStatus("error");
      await hangUp();
      setStatus("error");
    }
  }, [flushPartial, hangUp]);

  const sendText = useCallback((text: string) => {
    if (!sessionRef.current || !text.trim()) return;
    pushCaption("user", text);
    sessionRef.current.sendRealtimeInput({ text });
  }, [pushCaption]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      mutedRef.current = !m;
      streamRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = m;
      });
      return !m;
    });
  }, []);

  useEffect(() => {
    return () => {
      void hangUp();
    };
  }, [hangUp]);

  return {
    status,
    error,
    captions,
    interviewId,
    muted,
    micDenied,
    elapsed,
    startCall,
    hangUp,
    sendText,
    toggleMute,
  };
}
