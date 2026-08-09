export const MENU = [
  { id: "smash-burger", name: "Smash burger", detail: "Doble carne, queso", icon: "▣", price: 32 },
  { id: "ramen-miso", name: "Ramen miso", detail: "Hongos, huevo, nori", icon: "◒", price: 29 },
  { id: "tacos-pastor", name: "Tacos al pastor", detail: "Trío con piña", icon: "◈", price: 26 },
  { id: "curry-verde", name: "Curry verde", detail: "Arroz jazmín, tofu", icon: "◉", price: 28 },
  { id: "pizza-picante", name: "Pizza picante", detail: "Chorizo, miel, albahaca", icon: "◇", price: 34 },
  { id: "bowl-salmon", name: "Bowl de salmón", detail: "Quinua, palta, sésamo", icon: "◐", price: 36 },
];

export const STAGES = [
  { key: "received", label: "Recibido", agent: "chef" },
  { key: "cooking", label: "Cocinando", agent: "chef" },
  { key: "packed", label: "Empacado", agent: "gerente" },
  { key: "delivery", label: "En camino", agent: "repartidor" },
  { key: "delivered", label: "Entregado", agent: null },
];

export const AGENT_META = {
  chef: { label: "Chef", name: "Nara", role: "AGENTE CHEF", tagline: "Prioriza y prepara", avatarClass: "chef", avatarLetter: "N" },
  gerente: { label: "Gerente", name: "Mateo", role: "AGENTE GERENTE", tagline: "Balancea la carga", avatarClass: "manager", avatarLetter: "M" },
  repartidor: { label: "Repartidor", name: "Luna", role: "AGENTE REPARTIDOR", tagline: "Optimiza las rutas", avatarClass: "driver", avatarLetter: "L" },
  monitor: { label: "Monitor", name: "Ojo", role: "AGENTE MONITOR", tagline: "Cuida la continuidad", avatarClass: "monitor", avatarLetter: "O" },
};

export const FALLBACK_LINES = {
  chef: ["Ajustando la orden de cocción.", "Priorizando lo que ya está en la plancha.", "Revisando el ticket."],
  gerente: ["Reorganizando la cola.", "Confirmando empaque.", "Balanceando la carga de pedidos."],
  repartidor: ["Saliendo con el pedido.", "Calculando la ruta más rápida.", "Confirmando entrega."],
};

export const API_BASE = import.meta.env.VITE_API_BASE || "";
