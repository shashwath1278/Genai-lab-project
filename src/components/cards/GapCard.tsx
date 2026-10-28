"use client";

import { Inbox, Mail, Phone } from "lucide-react";

type GapOutput = {
  logged: boolean;
  topic: string;
  contact: { office: string; email: string; phone: string; hours: string } | null;
};

/** Shown when the model reports that the handbook doesn't cover the question. */
export function GapCard({ output }: { output: GapOutput }) {
  return (
    <section className="rise my-3 flex items-start gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-[13px]">
      <Inbox size={17} className="mt-0.5 shrink-0 text-muted" aria-hidden />
      <div className="min-w-0">
        <p className="font-medium text-ink" title={output.logged ? "Sent to staff to add" : undefined}>
          Not in the handbook yet
        </p>
        {output.contact && (
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-2">
            <span>{output.contact.office}</span>
            <a className="inline-flex items-center gap-1 hover:text-ink" href={`mailto:${output.contact.email}`}>
              <Mail size={13} aria-hidden /> {output.contact.email}
            </a>
            <span className="inline-flex items-center gap-1" title={output.contact.hours}>
              <Phone size={13} aria-hidden /> {output.contact.phone}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
