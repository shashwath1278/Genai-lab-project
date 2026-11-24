"use client";

import { Brain, ChatsCircle, Trash, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cx, IconButton } from "../ui";
import { ago, type MemoryState } from "./useMemory";

export function MemoryPanel({ memory, currentChatId, onOpenChat }: { memory: MemoryState; currentChatId: string; onOpenChat: (id: string) => void }) {
  const [confirmAll, setConfirmAll] = useState(false);
  const { enabled, facts, chats } = memory;

  return (
    <div className="space-y-6 p-4">
      <section aria-labelledby="memory-heading">
        <div className="flex items-center gap-2">
          <Brain size={17} weight="duotone" className="text-accent-text" aria-hidden />
          <h2 id="memory-heading" className="flex-1 font-display text-[22px] leading-none text-ink">
            What I remember
          </h2>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Memory"
            onClick={() => memory.setEnabled(!enabled)}
            className={cx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors", enabled ? "border-accent bg-accent" : "border-line-strong bg-surface-3")}
          >
            <motion.span
              layout
              transition={{ type: "spring", bounce: 0.3, duration: 0.35 }}
              className={cx("block size-4.5 rounded-full shadow-card", enabled ? "ml-5.5 bg-accent-ink" : "ml-0.5 bg-surface")}
            />
          </button>
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-muted">
          {enabled
            ? "Details from your questions, so you don't have to repeat them in a new chat. Kept only in this app's database, for this browser."
            : "Memory is off: I won't save or use anything about you. What's below stays until you delete it."}
        </p>

        {facts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line-strong px-3 py-4 text-center text-[12.5px] text-muted">
            Nothing yet. Ask about a programme, your rank or a hostel, and I&apos;ll keep the details here.
          </p>
        ) : (
          <ul className={cx("mt-3 space-y-2", !enabled && "opacity-60")}>
            <AnimatePresence initial={false}>
              {facts.map((f) => (
                <motion.li
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  className="flex items-start gap-2 rounded-xl border border-line bg-surface px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] text-muted">{f.label}</p>
                    <p className="text-[13.5px] font-medium text-ink">{f.value}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      from {f.source} · {ago(f.updatedAt)}
                    </p>
                  </div>
                  <IconButton label={`Forget ${f.label.toLowerCase()}`} icon={X} onClick={() => memory.forget(f.id)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        {facts.length > 0 &&
          (confirmAll ? (
            <p className="mt-2 flex items-center gap-2 text-[12.5px] text-ink-2">
              Forget everything?
              <button type="button" className="font-medium text-critical-text hover:underline" onClick={() => (memory.forgetAll(), setConfirmAll(false))}>
                Yes, forget
              </button>
              <button type="button" className="text-muted hover:underline" onClick={() => setConfirmAll(false)}>
                Cancel
              </button>
            </p>
          ) : (
            <button type="button" onClick={() => setConfirmAll(true)} className="mt-2 text-[12.5px] font-medium text-muted hover:text-critical-text">
              Forget everything
            </button>
          ))}
      </section>

      <section aria-labelledby="chats-heading">
        <div className="flex items-center gap-2">
          <ChatsCircle size={17} weight="duotone" className="text-accent-text" aria-hidden />
          <h2 id="chats-heading" className="flex-1 font-display text-[22px] leading-none text-ink">
            Your chats
          </h2>
          {chats.length > 0 && <span className="text-[12px] text-muted">{chats.length}</span>}
        </div>
        {chats.length === 0 ? (
          <p className="mt-3 text-[12.5px] text-muted">Conversations are saved here automatically, so you can pick one up later.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {chats.map((c) => {
              const current = c.id === currentChatId;
              return (
                <li key={c.id} className={cx("group flex items-center gap-1 rounded-xl pr-1 transition-colors", current ? "bg-accent-soft" : "hover:bg-surface-2")}>
                  <button type="button" onClick={() => onOpenChat(c.id)} aria-current={current || undefined} className="min-w-0 flex-1 px-3 py-2 text-left">
                    <span className="block truncate text-[13.5px] text-ink">{c.title}</span>
                    <span className="text-[11.5px] text-muted">
                      {current ? "Open now" : ago(c.updatedAt)} · {c.turns} {c.turns === 1 ? "question" : "questions"}
                    </span>
                  </button>
                  <span className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                    <IconButton label={`Delete "${c.title}"`} icon={Trash} onClick={() => memory.deleteChat(c.id)} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
