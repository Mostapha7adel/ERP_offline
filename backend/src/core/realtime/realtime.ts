import type { FastifyReply } from "fastify";

interface StreamClient {
  id: string;
  reply: FastifyReply;
}

/**
 * Server-Sent Events hub. Every authenticated device (host and clients) keeps
 * one long-lived HTTP stream open. When any device mutates data, the backend
 * broadcasts a `sync` event so every connected UI re-hydrates in real time.
 * No message payloads cross the wire beyond a resource hint — the actual data
 * is always re-read from the shared database, which keeps everyone consistent.
 */
const clients = new Map<string, StreamClient>();

export function subscribeStream(id: string, reply: FastifyReply): void {
  clients.set(id, { id, reply });
}

export function unsubscribeStream(id: string): void {
  clients.delete(id);
}

export function streamClientCount(): number {
  return clients.size;
}

/** Push a `sync` event to every connected stream (errors are non-fatal). */
export function broadcastSync(payload: { resource?: string } = {}): void {
  const data = JSON.stringify({ type: "sync", ...payload, ts: Date.now() });
  const frame = `event: sync\ndata: ${data}\n\n`;
  for (const client of clients.values()) {
    try {
      client.reply.raw.write(frame);
    } catch {
      // socket gone — the close handler removes it
    }
  }
}

/** Push a `kicked` event to a specific stream (used to force client logout). */
export function sendEvent(id: string, event: string, payload: Record<string, unknown> = {}): void {
  const client = clients.get(id);
  if (!client) return;
  const data = JSON.stringify({ ...payload, ts: Date.now() });
  try {
    client.reply.raw.write(`event: ${event}\ndata: ${data}\n\n`);
  } catch {
    // ignore
  }
}
