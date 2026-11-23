import type { Metadata } from "next";
import { Suspense } from "react";
import Workspace from "@/components/chat/Workspace";

export const metadata: Metadata = { title: "Chat · Northgate Copilot" };

// Workspace reads ?persona= and ?q= (deep links from the landing page), so it
// renders on the client inside a Suspense boundary.
export default function ChatPage() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
