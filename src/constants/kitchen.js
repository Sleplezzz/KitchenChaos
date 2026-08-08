import { ChefHat, Truck, Users, ShieldAlert } from "lucide-react";

export const MENU = [
  { id: "ceviche", name: "Ceviche Clásico", emoji: "🐟", time: 3 },
  { id: "lomo", name: "Lomo Saltado", emoji: "🥩", time: 4 },
  { id: "anticuchos", name: "Anticuchos", emoji: "🍢", time: 3 },
  { id: "causa", name: "Causa Limeña", emoji: "🥔", time: 2 },
  { id: "chicha", name: "Chicha Morada", emoji: "🍹", time: 1 },
];

export const STAGES = [
  { key: "received", label: "Recibido", agent: "chef" },
  { key: "cooking", label: "Cocinando", agent: "chef" },
  { key: "packed", label: "Empacado", agent: "gerente" },
  { key: "delivering", label: "En camino", agent: "repartidor" },
  { key: "delivered", label: "Entregado", agent: null },
];

export const AGENT_META = {
  chef: { label: "Chef", icon: ChefHat, color: "var(--flame)" },
  gerente: { label: "Gerente", icon: Users, color: "var(--brass)" },
  repartidor: { label: "Repartidor", icon: Truck, color: "var(--service)" },
  respaldo: { label: "Respaldo", icon: ShieldAlert, color: "var(--alert)" },
};

export const FALLBACK_LINES = {
  chef: ["Ajustando la orden de cocción.", "Priorizando lo que ya está en la plancha.", "Revisando el ticket."],
  gerente: ["Reorganizando la cola.", "Confirmando empaque.", "Balanceando la carga de pedidos."],
  repartidor: ["Saliendo con el pedido.", "Calculando la ruta más rápida.", "Confirmando entrega."],
  respaldo: [
    "Cubriendo el puesto mientras el agente principal no responde.",
    "Ejecutando protocolo simplificado de respaldo.",
    "Manteniendo el flujo sin el agente titular.",
  ],
};

export const API_BASE = import.meta.env.VITE_API_BASE || "";
