"use client";

import { ArrowUp, CircleNotch, FilePdf, Microphone, MicrophoneSlash, Paperclip, Stop, X } from "@phosphor-icons/react";
import type { FileUIPart } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { getLanguage } from "@/lib/college";
import { cx } from "../ui";
import { ACCEPT, MAX_ATTACHMENTS, prepareAttachment } from "./attachments";
import { useSpeechInput } from "./speech";

type Pending = { key: string; name: string; part: FileUIPart | null };

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
  onSubmit: (text: string, files: FileUIPart[]) => void;
  onStop: () => void;
  busy: boolean;
  language: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const lang = getLanguage(language);
  const before = useRef("");
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Pending[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

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

  const addFiles = (list: FileList | File[]) => {
    setFileError(null);
    const picked = [...list].slice(0, MAX_ATTACHMENTS - files.length);
    if (list.length > picked.length) setFileError(`Up to ${MAX_ATTACHMENTS} files at a time.`);
    for (const file of picked) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`;
      setFiles((f) => [...f, { key, name: file.name, part: null }]);
      prepareAttachment(file)
        .then((part) => setFiles((f) => f.map((x) => (x.key === key ? { ...x, part } : x))))
        .catch((e: Error) => {
          setFiles((f) => f.filter((x) => x.key !== key));
          setFileError(e.message);
        });
    }
  };

  const preparing = files.some((f) => !f.part);
  const ready = files.flatMap((f) => (f.part ? [f.part] : []));
  const canSend = !busy && !preparing && (!!value.trim() || ready.length > 0);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    voice.stop();
    onSubmit(value.trim() || "Read this for me and tell me what it means.", ready);
    setFiles([]);
    setFileError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = [...e.clipboardData.files].filter((f) => ACCEPT.includes(f.type));
    if (pasted.length) {
      e.preventDefault();
      addFiles(pasted);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const toggleMic = () => {
    if (voice.listening) voice.stop();
    else {
      before.current = value.trim();
      voice.start();
    }
  };

  return (
    <form onSubmit={submit} className="relative" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <div
        className={cx(
          "rounded-2xl border bg-surface p-1.5 shadow-card transition-colors",
          voice.listening || dragging ? "border-accent" : "border-line focus-within:border-line-strong",
        )}
      >
        <AnimatePresence initial={false}>
          {files.length > 0 && (
            <motion.ul
              className="flex flex-wrap gap-2 px-1.5 pb-1 pt-1.5"
              aria-label="Attachments"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {files.map((f) => (
                <li key={f.key} className="group relative">
                  {f.part?.mediaType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local data URL preview
                    <img src={f.part.url} alt={f.name} className="size-14 rounded-xl border border-line object-cover" />
                  ) : (
                    <span className="flex size-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-line bg-surface-2 px-1 text-muted" title={f.name}>
                      {f.part ? <FilePdf size={20} weight="duotone" className="text-laterite" aria-hidden /> : <CircleNotch size={18} className="animate-spin" aria-hidden />}
                      <span className="w-full truncate text-center text-[9.5px]">{f.part ? "PDF" : "Preparing"}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setFiles((all) => all.filter((x) => x.key !== f.key))}
                    aria-label={`Remove ${f.name}`}
                    className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-card hover:text-ink"
                  >
                    <X size={11} weight="bold" aria-hidden />
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-1.5">
          <input
            ref={picker}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={files.length >= MAX_ATTACHMENTS}
            aria-label="Attach a photo or PDF"
            title="Attach a photo or PDF: marks card, rank card, fee receipt or notice"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
          >
            <Paperclip size={17} aria-hidden />
          </button>
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
            onPaste={onPaste}
            placeholder={voice.listening ? "Listening…" : files.length ? "Ask about it, or just send" : "Ask anything about Northgate"}
            className="max-h-42 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] leading-6 text-ink outline-none placeholder:text-muted"
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
              {voice.listening ? <MicrophoneSlash size={17} aria-hidden /> : <Microphone size={17} aria-hidden />}
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
              <Stop size={13} weight="fill" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              title="Send"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink transition-colors hover:bg-accent-hover disabled:bg-surface-3 disabled:text-muted"
            >
              <ArrowUp size={17} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {(voice.error || fileError) && <p className="mt-1.5 px-1 text-[12px] text-critical-text">{fileError ?? voice.error}</p>}
    </form>
  );
}
