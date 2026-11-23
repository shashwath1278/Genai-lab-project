"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme-boot";
import { cx } from "./ui";

type Theme = "light" | "dark";
const CHANGE = "ng-theme-change";
const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

/** The theme in effect: a saved choice on <html data-theme>, else the system's. */
function resolved(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return darkQuery().matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = darkQuery();
  mq.addEventListener("change", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

export function useTheme(): [Theme | null, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, resolved, () => null);
  const setTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
    window.dispatchEvent(new Event(CHANGE));
  }, []);
  return [theme, setTheme];
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cx(
        "relative inline-flex size-9 items-center justify-center overflow-hidden rounded-full border border-line bg-surface text-ink transition-colors hover:border-line-strong",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme && (
          <motion.span
            key={theme}
            className="inline-flex"
            initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {theme === "dark" ? <Sun size={17} weight="duotone" aria-hidden /> : <Moon size={17} weight="duotone" aria-hidden />}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
