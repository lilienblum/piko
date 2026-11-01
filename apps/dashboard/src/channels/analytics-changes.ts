import { defineChannel } from "tako.sh";
import type { ChangeEnvelope } from "../lib/change-envelope";

// Durable hints let reconnecting clients catch up. Event data stays in the API.
export default defineChannel("analytics-changes", {
  replayWindowMs: 60_000,
}).$messageTypes<{ changed: ChangeEnvelope }>();
