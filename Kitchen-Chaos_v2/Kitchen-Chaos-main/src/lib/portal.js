import { Portal } from "@portalsdk/core";

/* ------------------------------------------------------------------
   Cliente de Portal — se construye UNA sola vez, a nivel de módulo.
   La construcción es síncrona y pasiva (no abre conexión hasta que
   un componente monta un canal), así que es seguro hacerlo aquí
   fuera de cualquier componente.

   Modo anónimo: no pasamos `token`, así que cada persona que abra
   el link recibe una identidad anónima estable automáticamente,
   sin necesidad de backend de autenticación (ver docs.useportal.co
   → Quickstart → "Zero-backend: anonymous mode").
-------------------------------------------------------------------*/

const apiKey = import.meta.env.VITE_PORTAL_API_KEY;

if (!apiKey && import.meta.env.DEV) {
  console.warn(
    "[Kitchen Chaos] Falta VITE_PORTAL_API_KEY en tu .env. " +
      "Sin ella, Portal no podrá conectar y cada pestaña quedará aislada. " +
      "Consigue tu key publicable (pk_...) en useportal.co y agrégala a .env (ver .env.example)."
  );
}

export const portal = new Portal({ apiKey: apiKey || "" });

// Un único canal global para todo el estado compartido de la cocina.
// Todo lo que pasa por acá (pedidos, avances de etapa, pensamientos
// de agentes, eventos caos) es un mensaje que Portal replica a todas
// las pestañas/dispositivos conectados en tiempo real.
export const KITCHEN_CHANNEL_ID = "kitchen-global";
