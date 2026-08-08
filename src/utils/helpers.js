import { MENU } from "../constants/kitchen.js";

let idCounter = 1;

export function getNextSerial() {
  return idCounter++;
}

export function uid() {
  return `${Date.now()}-${idCounter++}`;
}

export function randomOrderItems() {
  const n = 1 + Math.floor(Math.random() * 2);
  const shuffled = [...MENU].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map((m) => m.id);
}

export function itemNames(ids) {
  return ids
    .map((id) => MENU.find((m) => m.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
}

export function chaosBtnStyle(color) {
  return {
    background: "transparent",
    border: `1px solid ${color}`,
    color,
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    transition: "all 0.2s ease",
  };
}
