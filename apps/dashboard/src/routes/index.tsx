import { createFileRoute } from "@tanstack/react-router";
import { Overview } from "@/components/overview";
export const Route = createFileRoute("/")({ component: Overview });
