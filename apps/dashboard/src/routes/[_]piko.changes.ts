import { createFileRoute } from "@tanstack/react-router";
import { receiveChanges } from "../server/realtime";

export const Route = createFileRoute("/_piko/changes")({
  server: { handlers: { POST: ({ request }) => receiveChanges(request) } },
});
