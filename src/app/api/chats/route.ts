import { CHAT_ID, deleteChat, getChat, listChats } from "@/lib/chats";
import { getSessionId } from "@/lib/session";

// Saved conversations for this browser: list them, open one, delete one.

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const sessionId = await getSessionId();
  if (!id) return Response.json({ chats: listChats(sessionId) });
  if (!CHAT_ID.test(id)) return Response.json({ error: "Bad chat id." }, { status: 400 });
  const chat = getChat(sessionId, id);
  return chat ? Response.json({ chat }) : Response.json({ error: "Not found." }, { status: 404 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !CHAT_ID.test(id)) return Response.json({ error: "Expected ?id=" }, { status: 400 });
  const sessionId = await getSessionId();
  deleteChat(sessionId, id);
  return Response.json({ chats: listChats(sessionId) });
}
