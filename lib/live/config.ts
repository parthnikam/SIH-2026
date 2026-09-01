import { Modality, ThinkingLevel, type LiveConnectConfig } from "@google/genai";
import { SYSTEM_PROMPT } from "./system-prompt";
import { LIVE_TOOLS } from "./tools";

export const LIVE_MODEL = "gemini-3.1-flash-live-preview";

export function liveConnectConfig(): LiveConnectConfig {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: SYSTEM_PROMPT,
    tools: LIVE_TOOLS,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: "Sulafat" },
      },
    },
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.MINIMAL,
    },
  };
}
