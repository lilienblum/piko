import { useEffect, useRef, useState } from "react";
import { Channel } from "tako.sh/client";

// Refresh hints need no client-side message history. The transport reconnects automatically.
export function useChangeChannel(onMessage: (message: { type: string; data: unknown }) => void) {
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const [status, setStatus] = useState<"connecting" | "open">("connecting");
  useEffect(() => {
    const subscription = new Channel("analytics-changes").subscribe();
    const source = subscription.raw as EventTarget;
    const opened = () => {
      setStatus("open");
    };
    const failed = () => setStatus("connecting");
    const received = (event: Event) => {
      try {
        const message: unknown = JSON.parse((event as MessageEvent).data);
        if (
          message &&
          typeof message === "object" &&
          "type" in message &&
          typeof message.type === "string" &&
          "data" in message
        )
          handler.current({ type: message.type, data: message.data });
      } catch {
        // Invalid notifications cannot affect canonical data or break the stream.
      }
    };
    source.addEventListener("open", opened);
    source.addEventListener("error", failed);
    source.addEventListener("message", received);
    return () => {
      source.removeEventListener("open", opened);
      source.removeEventListener("error", failed);
      source.removeEventListener("message", received);
      subscription.close();
    };
  }, []);
  return { status };
}
