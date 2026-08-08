import { API_BASE, FALLBACK_LINES } from "../constants/kitchen.js";

export async function getAgentThought(role, situation) {
  try {
    const response = await fetch(`${API_BASE}/api/agent-thought`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, situation }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    return (
      data.text ||
      FALLBACK_LINES[role][Math.floor(Math.random() * FALLBACK_LINES[role].length)]
    );
  } catch (e) {
    console.warn(`Falling back for role ${role}:`, e.message);
    const lines = FALLBACK_LINES[role] || ["Procesando."];
    return lines[Math.floor(Math.random() * lines.length)];
  }
}
