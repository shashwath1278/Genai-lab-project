import type { Metadata } from "next";
import Workspace from "@/components/chat/Workspace";

export const metadata: Metadata = { title: "Chat · Northgate Copilot" };

// Rendered at build time, so the page shows up before its JavaScript does.
// (Deep links, ?persona= and ?q=, are read in the browser; see Workspace.)
export default function ChatPage() {
  return <Workspace />;
}
