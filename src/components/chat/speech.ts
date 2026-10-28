"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Browser-native voice: Web Speech API for input, speechSynthesis for read-aloud.
// Nothing leaves the browser except what the browser's own engine does.

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const noopSubscribe = () => () => {};

export function useSpeechInput(lang: string, onText: (text: string, final: boolean) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => !!getCtor(), () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  useEffect(() => {
    callback.current = onText;
  }, [onText]);

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    rec.current?.abort();
    const r = new Ctor();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        final ||= e.results[i].isFinal;
      }
      callback.current(text, final);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Microphone permission was denied." : `Voice input error: ${e.error}`);
    r.onend = () => setListening(false);
    setError(null);
    rec.current = r;
    r.start();
    setListening(true);
  }, [lang]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, error, start, stop };
}

/** Markdown and citation markers removed, so the voice reads clean sentences. */
export function speakableText(markdown: string): string {
  return markdown
    .replace(/\[(\d{1,2})\]/g, "")
    .replace(/[*_`#>|]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(text: string, lang: string, onEnd: () => void): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(speakableText(text));
  u.lang = lang;
  const prefix = lang.split("-")[0];
  const voice = synth.getVoices().find((v) => v.lang === lang) ?? synth.getVoices().find((v) => v.lang.startsWith(prefix));
  if (voice) u.voice = voice;
  u.onend = onEnd;
  u.onerror = onEnd;
  synth.speak(u);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
