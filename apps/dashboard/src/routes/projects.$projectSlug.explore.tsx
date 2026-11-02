import { createFileRoute } from "@tanstack/react-router";
import { Explore } from "@/components/explore";
import { validateExploreSearch } from "@/lib/explore-search";
export const Route = createFileRoute("/projects/$projectSlug/explore")({
  validateSearch: validateExploreSearch,
  component: Explore,
});
