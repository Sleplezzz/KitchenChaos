import { createRouter } from "@tanstack/react-router";
import { PortalProvider } from "@portalsdk/react";
import { portal } from "./portal/client";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <PortalProvider client={portal}>{children}</PortalProvider>
    ),
  });
  return router;
}
