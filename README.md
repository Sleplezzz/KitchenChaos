# Kitchen Chaos — Restaurante Autónomo con IA 🍳🤖

**Kitchen Chaos** es un MVP colaborativo en tiempo real donde tres roles humanos (Cliente, Cocinero, Gerente) y tres agentes de IA (Coordinador, Respaldo, Delivery) interactúan sobre un estado compartido de cocina.

---

## 🔌 Cómo funciona el tiempo real (Portal)

El estado de la cocina **no vive en el estado local del navegador**. Portal es la única fuente de verdad.

1. Los clientes se conectan a un canal de Portal (`kitchen-<ROOM_CODE>`).
2. Las acciones humanas publican eventos de dominio persistentes en el canal.
3. Portal envía esos eventos a un webhook de nuestro backend (Hono).
4. El backend reconstruye la proyección de la sala, invoca al agente de IA correspondiente, y publica el resultado de vuelta en el canal.
5. Todos los navegadores aplican el mismo reducer puro para reflejar los cambios instantáneamente.

No hay bases de datos externas, memorias a largo plazo, ni temporizadores locales.

---

## 🏗️ Estructura y Arquitectura del Proyecto

El proyecto está diseñado bajo una arquitectura desacoplada en TypeScript, alojada en un único despliegue de Vercel:

### 1. Dominio Compartido (`src/domain/` o `src/lib/`)
- **`reducer.ts`**: Reducer puro de TypeScript que proyecta el estado de la cocina a partir del stream de eventos de Portal. Es consumido tanto por el cliente (React) como por el backend (Hono) para garantizar una única fuente de verdad.
- **`events.ts`**: Definición de contratos de eventos de dominio (`order.created`, `station.failed`, `order.ready`, `order.assigned`, etc.) validados mediante Zod.

### 2. Frontend (`src/`) — React + Vite + TypeScript
- **`components/`**: Vistas adaptadas a los 3 roles de usuario:
  - **Customer:** Formulario de pedidos y estado en vivo.
  - **Cook:** Cola de preparación agrupada por estaciones (Principal / Reserva) ordenada por prioridad.
  - **Manager:** Tablero Kanban global y control del evento de caos (`station.failed`).
- **`hooks/useKitchenRoom.ts`**: Hook reactivo basado en `useChannel` de `@portalsdk/react` para sincronizar eventos, historial y presencia en tiempo real.

### 3. Backend (`api/` o `server/`) — Hono en Vercel Function
- **`index.ts`**: Punto de entrada de la función serverless en Hono.
- **`routes/webhook.ts`**: Endpoint (`POST /api/portal/webhook`) que valida firmas criptográficas de Portal, reconstruye la proyección con el reducer compartido, ejecuta los agentes y publica las decisiones.
- **`agents/`**: Lógica de agentes (`coordinator.ts`, `backup.ts`, `delivery.ts`) gobernada por Vercel AI SDK Core y AI Gateway, con esquemas estructurados estrictos y fallbacks deterministas.

---

## 🚀 Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior

---

## ⚙️ Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/Sleplezzz/KitchenChaos
   cd KitchenChaos
   ```

2. **Instalar dependencias:**
   ```bash
   pnpm install
   ```

3. **Configurar variables de entorno**

# Frontend
VITE_PORTAL_PUBLISHABLE_KEY=pk_tu_key_publicable

# Backend (Hono)
PORTAL_SECRET=sk_tu_secret_key
PORTAL_WEBHOOK_SECRET=tu_webhook_secret
AI_GATEWAY_API_KEY=tu_api_key_de_gateway
AI_MODEL=identificador_del_modelo_rapido

---

## 🛠️ Comandos de Ejecución

# Iniciar el entorno de desarrollo
pnpm dev

# Validar tipos TypeScript
pnpm typecheck

# Ejecutar tests unitarios y de reducer
pnpm test

# Ejecutar tests en modo watch
pnpm test:watch

# Compilar para producción
pnpm build

## ⚡ Funcionalidades (Roles y Agentes)

### Roles Humanos
- **Customer (Cliente):** Crea los pedidos.
- **Cook (Cocinero):** Selecciona pedidos activos y los marca como listos.
- **Manager (Gerente):** Desencadena el evento de caos (fallo de la estación principal).

### Agentes de IA
- **Coordinator:** Asigna estación y prioridad a un nuevo pedido.
- **Backup:** Reasigna pedidos a la estación de reserva si ocurre un fallo.
- **Delivery:** Marca los pedidos listos como entregados.

### Evento de Caos (MVP)
- **Fallo de Estación (`station.failed`):** El gerente inhabilita la estación principal, obligando al agente de respaldo (Backup) a intervenir y reasignar el flujo de trabajo en tiempo real. No se admiten otros eventos de caos en esta versión MVP.
