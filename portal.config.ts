import { defineConfig } from "@portalsdk/config";

const webhookUrl = process.env.PORTAL_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error("PORTAL_WEBHOOK_URL is required for portal deploy.");
}

export default defineConfig({
  channels: {
    "kitchen-*": { anonymous: true },
  },
  webhooks: {
    url: webhookUrl,
  },
});
