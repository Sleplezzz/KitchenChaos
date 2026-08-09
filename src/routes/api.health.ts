import { createFileRoute } from "@tanstack/react-router";
import { honoApp } from "../../server/app";
import { forwardToHono } from "../../server/start-adapter";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => forwardToHono(honoApp, request),
    },
  },
});
