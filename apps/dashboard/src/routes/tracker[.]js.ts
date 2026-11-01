import { createFileRoute } from "@tanstack/react-router";
import source from "virtual:piko-tracker";

export const Route = createFileRoute("/tracker.js")({
  server: {
    handlers: {
      GET: () =>
        new Response(source, {
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
          },
        }),
    },
  },
});
