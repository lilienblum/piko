import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/overview";
import { validateOverviewSearch } from "@/lib/workspace-search";
export const Route = createFileRoute("/")({
  validateSearch: validateOverviewSearch,
  component: Overview,
});
