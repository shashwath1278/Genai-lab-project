"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { ArrowCounterClockwise, BookOpen, Brain, ClipboardText, FilePdf, ImageSquare, NotePencil, Warning, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CopilotMessage } from "@/lib/chat-types";
import { getLanguage, LANGUAGES, PERSONAS, type LanguageId, type PersonaId } from "@/lib/college";
import { EvidencePanel } from "../evidence/EvidencePanel";
import { MemoryPanel, useMemory } from "../memory/MemoryPanel";
import { PlanBoard } from "../plan/PlanBoard";
import { PlanProvider, usePlan } from "../plan/PlanContext";
import { Button, cx } from "../ui";
import { AssistantMessage, getEvidence, getWebResults, messageText, TypingDots } from "./AssistantMessage";
import { withoutOldAttachments } from "./attachments";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { Header, type Status } from "./Header";
import { speak, stopSpeaking } from "./speech";

// Earlier attachments were read already: only the newest message carries files.
const transport = new DefaultChatTransport<CopilotMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
    body: { ...body, id, trigger, messageId, messages: withoutOldAttachments(messages) },
  }),
});

// Persona and language are per-browser conveniences: localStorage, with an
// in-memory fallback when storage is unavailable.
const memory = new Map<string, string>();
const STORE_EVENT = "ng-store";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(STORE_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(STORE_EVENT, cb);
  };
};
function useStoredChoice<T extends string>(key: string, fallback: T, valid: readonly T[]): [T, (v: T) => void] {
  const read = () => {
    let v: string | null | undefined = memory.get(key);
    try {
      v = localStorage.getItem(key) ?? v;
    } catch {}
    return valid.includes(v as T) ? (v as T) : fallback;
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const set = useCallback(
    (v: T) => {
      memory.set(key, v);
      try {
        localStorage.setItem(key, v);
      } catch {}
      window.dispatchEvent(new Event(STORE_EVENT));
    },
    [key],
  );
  return [value, set];
}

const PERSONA_IDS = PERSONAS.map((p) => p.id);
const LANGUAGE_IDS = LANGUAGES.map((l) => l.id);

export type PanelTab = "evidence" | "plan" | "memory";

const newChatId = () => `chat-${crypto.randomUUID()}`;

function readError(error: Error | undefined): string | null {
  if (!error) return null;
  try {
    return JSON.parse(error.message).error ?? error.message;
  } catch {
    return error.message;
  }
}

export default function Workspace() {
  return (
    <MotionConfig reducedMotion="user">
      <PlanProvider>
        <WorkspaceInner />
      </PlanProvider>
    </MotionConfig>
  );
}

function WorkspaceInner() {
  const [persona, setPersona] = useStoredChoice<PersonaId>("ng-persona", "prospective", PERSONA_IDS);
  const [language, setLanguage] = useStoredChoice<LanguageId>("ng-language", "en", LANGUAGE_IDS);
  // Each conversation has an id; switching it (new chat, or one from history) gives useChat a fresh thread.
  const [thread, setThread] = useState<{ id: string; messages: CopilotMessage[] }>(() => ({ id: newChatId(), messages: [] }));
  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat<CopilotMessage>({ id: thread.id, messages: thread.messages, transport });
  const memory = useMemory();
  const plan = usePlan();

  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ n: number; tick: number } | null>(null);
  const [tab, setTab] = useState<PanelTab>("evidence");
  const [drawer, setDrawer] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [info, setInfo] = useState<Status | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";

  // Refresh status (LLM, open-gap count), memory and saved chats on load and after each answer.
  const refreshMemory = memory.refresh;
  useEffect(() => {
    if (busy) return;
    fetch("/api/status")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
    refreshMemory();
  }, [busy, refreshMemory]);

  // Follow the stream if the reader is already near the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
    if (nearBottom || status === "submitted") el.scrollTo({ top: el.scrollHeight, behavior: status === "streaming" ? "auto" : "smooth" });
  }, [messages, status]);

  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  // Deep links from the landing page: /chat?persona=parent&q=... sets the
  // persona and asks the question once, then tidies the URL.
  const params = useSearchParams();
  const router = useRouter();
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current) return;
    deepLinked.current = true;
    const p = params.get("persona") as PersonaId | null;
    const q = params.get("q")?.trim();
    const linkedPersona = p && PERSONA_IDS.includes(p) ? p : null;
    if (linkedPersona) setPersona(linkedPersona);
    if (q) sendMessage({ text: q }, { body: { persona: linkedPersona ?? persona, language } });
    if (p || q) router.replace("/chat", { scroll: false });
  }, [params, router, setPersona, sendMessage, persona, language]);

  const hasSources = (m: CopilotMessage) => m.role === "assistant" && (!!getEvidence(m) || getWebResults(m).length > 0);
  const withEvidence = messages.filter(hasSources);
  const selected = messages.find((m) => m.id === selectedId && hasSources(m)) ?? withEvidence.at(-1);
  const evidence = selected ? (getEvidence(selected) ?? null) : null;

  const ask = (text: string, files: FileUIPart[] = []) => {
    if ((!text.trim() && !files.length) || busy) return;
    clearError();
    setSelectedId(null);
    setFocus(null);
    setInput("");
    sendMessage(files.length ? { text, files } : { text }, { body: { persona, language } });
  };

  const applyTemplate = (template: string) => {
    setInput(template);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(template.length, template.length);
    });
  };

  const openPanel = (next: PanelTab) => {
    setTab(next);
    if (!window.matchMedia("(min-width: 1024px)").matches) setDrawer(true);
  };

  const cite = (messageId: string, n: number) => {
    setSelectedId(messageId);
    setFocus((f) => ({ n, tick: (f?.tick ?? 0) + 1 }));
    openPanel("evidence");
  };

  const sendFeedback = (queryId: number, value: "up" | "down") => {
    setFeedback((f) => ({ ...f, [queryId]: value }));
    fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ queryId, value }) }).catch(() => {});
  };

  const toggleSpeak = (m: CopilotMessage) => {
    if (speakingId === m.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    if (speak(messageText(m), getLanguage(language).speech, () => setSpeakingId((id) => (id === m.id ? null : id)))) setSpeakingId(m.id);
  };

  const resetView = () => {
    stop();
    stopSpeaking();
    setSpeakingId(null);
    setSelectedId(null);
    setFocus(null);
    clearError();
  };

  const newChat = () => {
    resetView();
    setThread({ id: newChatId(), messages: [] });
  };

  // Reopen a saved conversation and carry on from where it stopped.
  const openChat = (id: string) => {
    if (id === thread.id) return setDrawer(false);
    fetch(`/api/chats?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ chat }: { chat: { id: string; messages: CopilotMessage[] } }) => {
        resetView();
        setThread({ id: chat.id, messages: chat.messages });
        setDrawer(false);
      })
      .catch(() => memory.refresh());
  };

  const errorText = readError(error);
  const panel = (id: string) => (
    <SidePanel id={id} tab={tab} onTab={setTab} planCount={plan.items.filter((i) => !i.done).length} memoryCount={memory.enabled ? memory.facts.length : 0}>
      {tab === "evidence" ? (
        <EvidencePanel evidence={evidence} web={selected ? getWebResults(selected) : []} focusN={focus?.n ?? null} focusTick={focus?.tick ?? 0} />
      ) : tab === "plan" ? (
        <PlanBoard />
      ) : (
        <MemoryPanel memory={memory} currentChatId={thread.id} onOpenChat={openChat} />
      )}
    </SidePanel>
  );

  return (
    <div className="flex h-dvh flex-col">
      <Header
        persona={persona}
        onPersona={setPersona}
        language={language}
        onLanguage={setLanguage}
        status={info}
        planCount={plan.items.filter((i) => !i.done).length}
        onOpenPanel={openPanel}
      />
      {info && !info.llm && (
        <div className="flex items-center justify-center gap-2 border-b border-line bg-surface-2 px-4 py-1.5 text-[12.5px] text-ink-2">
          <Warning size={14} className="shrink-0 text-warning-text" aria-hidden />
          <span>
            Add <code className="font-mono text-[12px]">GEMINI_API_KEY</code> or <code className="font-mono text-[12px]">GROQ_API_KEY</code> to{" "}
            <code className="font-mono text-[12px]">.env.local</code> to chat.
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div ref={scroller} className="scrollbar-thin flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-4 pb-6 pt-4 sm:px-6">
              {messages.length === 0 ? (
                <EmptyState
                  persona={persona}
                  onAsk={(q) => ask(q)}
                  onTemplate={applyTemplate}
                  webSearch={!!info?.webSearch}
                  remembered={memory.enabled ? memory.facts : []}
                  onOpenMemory={() => openPanel("memory")}
                />
              ) : (
                <div className="space-y-6 pt-2">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <motion.div
                        key={m.id}
                        className="flex justify-end"
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
                        style={{ transformOrigin: "100% 100%" }}
                      >
                        <div className="flex max-w-[85%] flex-col items-end gap-1.5">
                          <UserAttachments message={m} />
                          <p className="whitespace-pre-wrap rounded-3xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] text-accent-ink shadow-card">{messageText(m)}</p>
                        </div>
                      </motion.div>
                    ) : (
                      <AssistantMessage
                        key={m.id}
                        message={m}
                        streaming={busy}
                        isLast={i === messages.length - 1}
                        selected={selected?.id === m.id}
                        feedback={feedback[getEvidence(m)?.queryId ?? -1]}
                        speaking={speakingId === m.id}
                        onCite={(n) => cite(m.id, n)}
                        onShowEvidence={() => {
                          setSelectedId(m.id);
                          setFocus(null);
                          openPanel("evidence");
                        }}
                        onFeedback={(v) => {
                          const q = getEvidence(m)?.queryId;
                          if (q != null) sendFeedback(q, v);
                        }}
                        onSpeak={() => toggleSpeak(m)}
                        onFollowUp={ask}
                        onOpenMemory={() => openPanel("memory")}
                      />
                    ),
                  )}
                  {status === "submitted" && messages.at(-1)?.role === "user" && (
                    <div className="pl-10">
                      <TypingDots label="Searching…" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 bg-linear-to-t from-bg via-bg to-transparent pt-2">
            <div className="mx-auto max-w-3xl px-4 pb-3 sm:px-6">
              {errorText && (
                <div className="mb-2 flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink-2">
                  <Warning size={15} className="mt-0.5 shrink-0 text-critical-text" aria-hidden />
                  <span className="flex-1">{errorText}</span>
                  {messages.length > 0 && (
                    <Button size="sm" variant="ghost" icon={ArrowCounterClockwise} onClick={() => regenerate({ body: { persona, language } })}>
                      Retry
                    </Button>
                  )}
                </div>
              )}
              {messages.length > 0 && (
                <div className="mb-2 flex justify-end">
                  <Button size="sm" variant="ghost" icon={NotePencil} onClick={newChat}>
                    New chat
                  </Button>
                </div>
              )}
              <Composer value={input} onChange={setInput} onSubmit={(t, f) => ask(t, f)} onStop={stop} busy={busy} language={language} inputRef={inputRef} />
            </div>
          </div>
        </main>

        <aside className="hidden w-105 shrink-0 border-l border-line bg-surface/40 lg:flex lg:flex-col">{panel("aside")}</aside>
      </div>

      <AnimatePresence>
        {drawer && (
          <motion.div
            key="drawer"
            className="fixed inset-0 z-40 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={tab === "evidence" ? "Sources" : tab === "plan" ? "Plan" : "Memory"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop: a pointer convenience; keyboard users get Escape and the Close button. */}
            <div aria-hidden className="absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
            <motion.div
              className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-bg shadow-card"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            >
              <div className="flex justify-end px-2 pt-2">
                <Button size="sm" variant="ghost" icon={X} onClick={() => setDrawer(false)}>
                  Close
                </Button>
              </div>
              {panel("drawer")}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {plan.toast && (
          <motion.div
            key="toast"
            role="status"
            className="fixed bottom-24 left-1/2 z-50 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg shadow-card"
            initial={{ opacity: 0, y: 12, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 8, x: "-50%" }}
          >
            {plan.toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Photos and PDFs the user sent, above their message. */
function UserAttachments({ message }: { message: CopilotMessage }) {
  const files = message.parts.filter((p): p is FileUIPart => p.type === "file");
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {files.map((f, i) =>
        !f.url ? (
          // A saved chat keeps the file's name, not the file.
          <span key={i} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface px-3 py-2 text-[12.5px] text-muted">
            {f.mediaType.startsWith("image/") ? <ImageSquare size={15} aria-hidden /> : <FilePdf size={15} aria-hidden />}
            {f.filename ?? "Attachment"} <span className="text-[11.5px]">(not kept)</span>
          </span>
        ) : f.mediaType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL the user just attached
          <img key={i} src={f.url} alt={f.filename ?? "Attached photo"} className="max-h-44 max-w-56 rounded-2xl border border-line object-cover shadow-card" />
        ) : (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink-2 shadow-card">
            <FilePdf size={16} weight="duotone" className="text-laterite" aria-hidden />
            {f.filename ?? "Document.pdf"}
          </span>
        ),
      )}
    </div>
  );
}

function SidePanel({
  id,
  tab,
  onTab,
  planCount,
  memoryCount,
  children,
}: {
  id: string;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  planCount: number;
  memoryCount: number;
  children: ReactNode;
}) {
  const tabs: { id: PanelTab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { id: "evidence", label: "Sources", icon: BookOpen },
    { id: "plan", label: "Plan", icon: ClipboardText, count: planCount },
    { id: "memory", label: "Memory", icon: Brain, count: memoryCount },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 gap-1 border-b border-line px-3 pt-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={cx(
              "relative -mb-px inline-flex items-center gap-1.5 px-3 py-2.5 text-[13.5px] font-medium transition-colors",
              tab === t.id ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            <t.icon size={15} weight={tab === t.id ? "duotone" : "regular"} aria-hidden />
            {t.label}
            {!!t.count && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-soft px-1 text-[10px] font-semibold text-accent-text">{t.count}</span>}
            {tab === t.id && <motion.span layoutId={`tab-underline-${id}`} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
