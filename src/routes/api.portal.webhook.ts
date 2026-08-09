import { createFileRoute } from "@tanstack/react-router";
import { getProductionApp } from "../../server/production";
import { forwardToHono } from "../../server/start-adapter";

export const Route = createFileRoute("/api/portal/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        forwardToHono(getProductionApp(), request),
    },
  },
});
