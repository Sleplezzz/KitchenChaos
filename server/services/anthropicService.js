import { config } from "../config.js";

const FALLBACK_LINES = {
  chef: ["Ajustando la orden de cocción.", "Priorizando lo que ya está en la plancha."],
  gerente: ["Reorganizando la cola.", "Confirmando empaque."],
  repartidor: ["Saliendo con el pedido.", "Calculando la ruta más rápida."],
  respaldo: ["Cubriendo el puesto mientras el agente principal no responde."],
};

export function pickFallback(role) {
  const lines = FALLBACK_LINES[role] || ["Procesando."];
  return lines[Math.floor(Math.random() * lines.length)];
}

export async function generateAgentThought(role, situation) {
  if (!config.anthropicApiKey) {
    console.warn("ANTHROPIC_API_KEY no configurada — devolviendo frase de respaldo.");
    return { text: pickFallback(role), fallback: true };
  }

  const prompt = `Eres el agente "${role}" dentro de un juego/demo de un restaurante gestionado por IA llamado Kitchen Chaos. Responde en español, en primera persona, UNA sola frase corta (menos de 14 palabras), tono decidido y humano, sin comillas ni markdown. Situación: ${situation}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 60,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return { text: pickFallback(role), fallback: true };
    }

    const data = await response.json();
    const text = (data.content || [])
      .map((b) => (b.type === "text" ? b.text : ""))
      .join(" ")
      .replace(/["""]/g, "")
      .trim();

    return { text: text || pickFallback(role) };
  } catch (err) {
    console.error("Error llamando a Anthropic:", err);
    return { text: pickFallback(role), fallback: true };
  }
}
