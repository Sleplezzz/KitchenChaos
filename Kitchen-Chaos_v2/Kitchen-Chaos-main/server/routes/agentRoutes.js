import { Router } from "express";
import { generateAgentThought } from "../services/anthropicService.js";

const router = Router();

router.post("/agent-thought", async (req, res) => {
  const { role, situation } = req.body || {};

  if (!role || !situation) {
    return res.status(400).json({ error: "Faltan 'role' o 'situation' en el body." });
  }

  const result = await generateAgentThought(role, situation);
  return res.json(result);
});

router.get("/health", (req, res) => {
  return res.json({ ok: true, status: "healthy", timestamp: new Date().toISOString() });
});

export default router;
