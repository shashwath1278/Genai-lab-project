"use client";

import { ArrowUp, Mic, MicOff, Square } from "lucide-react";
import { useCallback, useEffect, useRef, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { getLanguage } from "@/lib/college";
import { cx } from "../ui";
import { useSpeechInput } from "./speech";

export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  language,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  language: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const lang = getLanguage(language);
  const before = useRef("");
  const onVoice = useCallback(
    (text: string, final: boolean) => {
      const next = (before.current ? before.current + " " : "") + text;
      onChange(next);
      if (final) before.current = next;
    },
    [onChange],
  );
  const voice = useSpeechInput(lang.speech, onVoice);

  // Grow the textarea with its content, up to ~6 lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value, inputRef]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !value.trim()) return;
    voice.stop();
    onSubmit(value.trim());
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const toggleMic = () => {
    if (voice.listening) voice.stop();
    else {
      before.current = value.trim();
      voice.start();
    }
  };

  return (
    <form onSubmit={submit} className="relative">
      <div
        className={cx(
          "flex items-end gap-1.5 rounded-2xl border bg-surface p-1.5 shadow-card transition-colors",
          voice.listening ? "border-accent" : "border-line focus-within:border-line-strong",
        )}
      >
        <label htmlFor="composer" className="sr-only">
          Ask about Northgate
        </label>
        <textarea
          id="composer"
          ref={inputRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={voice.listening ? "Listening…" : "Ask anything about Northgate"}
          className="max-h-42 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-6 text-ink outline-none placeholder:text-muted"
        />
        {voice.supported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={voice.listening}
            aria-label={voice.listening ? "Stop" : `Speak (${lang.label})`}
            title={voice.listening ? "Stop" : `Speak (${lang.label})`}
            className={cx(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              voice.listening ? "bg-accent-soft text-accent-text" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {voice.listening ? <MicOff size={17} aria-hidden /> : <Mic size={17} aria-hidden />}
          </button>
        )}
        {busy ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop"
            title="Stop"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink text-bg hover:opacity-85"
          >
            <Square size={13} fill="currentColor" aria-hidden />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send"
            title="Send"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink transition-colors hover:bg-accent-hover disabled:bg-surface-3 disabled:text-muted"
          >
            <ArrowUp size={17} aria-hidden />
          </button>
        )}
      </div>
      {voice.error && <p className="mt-1.5 px-1 text-[12px] text-critical-text">{voice.error}</p>}
    </form>
  );
}
