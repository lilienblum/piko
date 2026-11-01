import { defineChannel } from "tako.sh";
import type { ChangeEnvelope } from "../lib/change-envelope";

// Live hints have no replay history. Reconnecting clients query the API to catch up.
export default defineChannel("analytics-changes", {
  ephemeral: true,
}).$messageTypes<{ changed: ChangeEnvelope }>();
