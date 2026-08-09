import { createFileRoute } from "@tanstack/react-router";
import { honoApp } from "../../server/app";
import { forwardToHono } from "../../server/start-adapter";

export const Route = createFileRoute("/api/portal/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => forwardToHono(honoApp, request),
    },
  },
});
