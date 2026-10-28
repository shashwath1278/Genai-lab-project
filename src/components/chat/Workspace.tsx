"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { BookOpen, ClipboardList, RotateCcw, SquarePen, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CopilotMessage } from "@/lib/chat-types";
import { getLanguage, LANGUAGES, PERSONAS, type LanguageId, type PersonaId } from "@/lib/college";
import { EvidencePanel } from "../evidence/EvidencePanel";
import { PlanBoard } from "../plan/PlanBoard";
import { PlanProvider, usePlan } from "../plan/PlanContext";
import { Button, cx } from "../ui";
import { AssistantMessage, getEvidence, messageText, TypingDots } from "./AssistantMessage";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { Header, type Status } from "./Header";
import { speak, stopSpeaking } from "./speech";

const transport = new DefaultChatTransport<CopilotMessage>({ api: "/api/chat" });

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
    <PlanProvider>
      <WorkspaceInner />
    </PlanProvider>
  );
}

function WorkspaceInner() {
  const [persona, setPersona] = useStoredChoice<PersonaId>("ng-persona", "prospective", PERSONA_IDS);
  const [language, setLanguage] = useStoredChoice<LanguageId>("ng-language", "en", LANGUAGE_IDS);
  const { messages, sendMessage, status, error, stop, regenerate, clearError, setMessages } = useChat<CopilotMessage>({ transport });
  const plan = usePlan();

  const [input, setInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ n: number; tick: number } | null>(null);
  const [tab, setTab] = useState<"evidence" | "plan">("evidence");
  const [drawer, setDrawer] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [info, setInfo] = useState<Status | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";

  // Refresh status (LLM, open-gap count) on load and after each answer.
  useEffect(() => {
    if (busy) return;
    fetch("/api/status")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, [busy]);

  // Follow the stream if the reader is already near the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
    if (nearBottom || status === "submitted") el.scrollTo({ top: el.scrollHeight, behavior: status === "streaming" ? "auto" : "smooth" });
  }, [messages, status]);

  useEffect(() => () => stopSpeaking(), []);

  const withEvidence = messages.filter((m) => m.role === "assistant" && getEvidence(m));
  const selected = messages.find((m) => m.id === selectedId && getEvidence(m)) ?? withEvidence.at(-1);
  const evidence = selected ? (getEvidence(selected) ?? null) : null;

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    clearError();
    setSelectedId(null);
    setFocus(null);
    setInput("");
    sendMessage({ text }, { body: { persona, language } });
  };

  const applyTemplate = (template: string) => {
    setInput(template);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(template.length, template.length);
    });
  };

  const openPanel = (next: "evidence" | "plan") => {
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

  const newChat = () => {
    stop();
    stopSpeaking();
    setMessages([]);
    setSelectedId(null);
    setFocus(null);
    clearError();
  };

  const errorText = readError(error);
  const panel = (
    <SidePanel tab={tab} onTab={setTab} planCount={plan.items.filter((i) => !i.done).length}>
      {tab === "evidence" ? <EvidencePanel evidence={evidence} focusN={focus?.n ?? null} focusTick={focus?.tick ?? 0} /> : <PlanBoard />}
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
          <TriangleAlert size={14} className="shrink-0 text-warning-text" aria-hidden />
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
                <EmptyState persona={persona} onAsk={ask} onTemplate={applyTemplate} />
              ) : (
                <div className="space-y-6 pt-2">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <div key={m.id} className="rise flex justify-end">
                        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-line bg-surface px-4 py-2.5 text-[15px] text-ink shadow-card">
                          {messageText(m)}
                        </p>
                      </div>
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
                  <TriangleAlert size={15} className="mt-0.5 shrink-0 text-critical-text" aria-hidden />
                  <span className="flex-1">{errorText}</span>
                  {messages.length > 0 && (
                    <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => regenerate({ body: { persona, language } })}>
                      Retry
                    </Button>
                  )}
                </div>
              )}
              {messages.length > 0 && (
                <div className="mb-2 flex justify-end">
                  <Button size="sm" variant="ghost" icon={SquarePen} onClick={newChat}>
                    New chat
                  </Button>
                </div>
              )}
              <Composer value={input} onChange={setInput} onSubmit={ask} onStop={stop} busy={busy} language={language} inputRef={inputRef} />
            </div>
          </div>
        </main>

        <aside className="hidden w-105 shrink-0 border-l border-line lg:flex lg:flex-col">{panel}</aside>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={tab === "evidence" ? "Sources" : "Plan"}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-bg shadow-card">
            <div className="flex justify-end px-2 pt-2">
              <Button size="sm" variant="ghost" icon={X} onClick={() => setDrawer(false)}>
                Close
              </Button>
            </div>
            {panel}
          </div>
        </div>
      )}

      {plan.toast && (
        <div role="status" className="rise fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg shadow-card">
          {plan.toast}
        </div>
      )}
    </div>
  );
}

function SidePanel({ tab, onTab, planCount, children }: { tab: "evidence" | "plan"; onTab: (t: "evidence" | "plan") => void; planCount: number; children: ReactNode }) {
  const tabs = [
    { id: "evidence" as const, label: "Sources", icon: BookOpen },
    { id: "plan" as const, label: "Plan", icon: ClipboardList, count: planCount },
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
              "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <t.icon size={14} aria-hidden />
            {t.label}
            {!!t.count && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-soft px-1 text-[10px] font-semibold text-accent-text">{t.count}</span>}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
