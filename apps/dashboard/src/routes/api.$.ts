import { createFileRoute } from "@tanstack/react-router";
import { proxyApi } from "../server/api-gateway";

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyApi(request),
      HEAD: ({ request }) => proxyApi(request),
      POST: ({ request }) => proxyApi(request),
      PUT: ({ request }) => proxyApi(request),
      PATCH: ({ request }) => proxyApi(request),
      DELETE: ({ request }) => proxyApi(request),
      OPTIONS: ({ request }) => proxyApi(request),
    },
  },
});
