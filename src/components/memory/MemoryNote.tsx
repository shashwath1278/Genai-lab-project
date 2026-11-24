"use client";

import { Brain } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { factText } from "./useMemory";

/** "Memory updated" under an answer that taught the assistant something. */
export function MemoryNote({ saved, onManage }: { saved: { label: string; value: string }[]; onManage: () => void }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-muted"
    >
      <Brain size={14} weight="duotone" className="text-accent-text" aria-hidden />
      <span className="font-medium text-ink-2">Memory updated:</span>
      {saved.map((s, i) => (
        <span key={s.label} title={s.label}>
          {factText(s)}
          {i < saved.length - 1 && " ·"}
        </span>
      ))}
      <button type="button" onClick={onManage} className="font-medium text-accent-text hover:underline">
        Manage
      </button>
    </motion.p>
  );
}
