import { Portal } from "@portalsdk/core";

/** Single browser Portal client. Anonymous mode (no token). Passive until useChannel. */
export const portal = new Portal({
  apiKey: import.meta.env.VITE_PORTAL_PUBLISHABLE_KEY,
});
