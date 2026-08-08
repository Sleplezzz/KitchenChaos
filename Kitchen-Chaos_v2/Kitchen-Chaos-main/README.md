# Kitchen Chaos — Restaurante Autónomo con IA 🍳🤖

**Kitchen Chaos** es una aplicación interactiva que simula la operación en tiempo real de un restaurante gestionado por agentes de Inteligencia Artificial (Chef, Gerente, Repartidor y Respaldo) impulsados por los modelos de Anthropic (Claude), sincronizada en tiempo real entre todos los dispositivos conectados mediante **Portal**.

---

## 🔌 Cómo funciona el tiempo real (Portal)

El estado de la cocina (pedidos, etapas, pensamientos de los agentes, eventos caos) **no vive en `useState` local** — vive en un único canal de Portal (`kitchen-global`). Cada pestaña/dispositivo que abre la app:

1. Se conecta al canal en modo anónimo (sin necesidad de login).
2. Reconstruye el estado leyendo el historial de mensajes del canal (patrón *event sourcing* — ver `src/lib/kitchenReducer.js`).
3. Ve, en vivo, cada mensaje nuevo que publique cualquier otro cliente conectado.

Para evitar que cada pestaña abierta corra su propio "reloj" de cocina (lo que duplicaría pedidos y llamadas a la IA), se usa la **presencia** del canal para elegir una única pestaña "líder" — de forma determinista, la de menor id de sesión entre los participantes conectados — que es la única que hace avanzar los pedidos automáticamente y genera pedidos de fondo. Cualquier pestaña puede seguir haciendo pedidos y disparando eventos caos sin ser la líder.

---

## 🏗️ Arquitectura Modular

El proyecto ha sido organizado en una arquitectura desacoplada y modular:

### 1. Frontend (`src/`) — React + Vite
- **`src/components/`**: Componentes de interfaz aislados y reutilizables (`Header`, `AdminDrawer`, `MetricsBar`, `OrderForm`, `KanbanBoard`, `AgentPanel`, `FeedPanel`, `TicketCard`, `MetricCard`).
- **`src/hooks/`**: Hook personalizado `useKitchenChaos` para la gestión centralizada del estado, simulación de pedidos y eventos de caos.
- **`src/services/`**: Cliente API (`api.js`) para la comunicación con el servidor backend proxy.
- **`src/constants/`**: Configuración global (`kitchen.js`) del menú, estados de la cocina y líneas de respaldo.
- **`src/utils/`**: Funciones auxiliares (`helpers.js`) para generación de identificadores, nombres de platos y utilidades.
- **`src/index.css`**: Sistema de diseño visual con tokens CSS, tipografías y animaciones.

### 2. Backend (`server/`) — Express API Proxy
- **`server/index.js`**: Punto de entrada del servidor Express.
- **`server/routes/`**: Rutas de la API (`/api/agent-thought`, `/api/health`).
- **`server/services/`**: Servicio de integración con la API de Anthropic (`anthropicService.js`) con manejo de fallbacks.
- **`server/config.js`**: Gestión centralizada de variables de entorno.

---

## 🚀 Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior

---

## ⚙️ Instalación y Configuración

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/DanielLazaro1555/Kitchen-Chaos.git
   cd Kitchen-Chaos
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar la key de Portal (obligatoria para el tiempo real):**
   Copia `.env.example` a `.env` en la raíz y agrega tu key publicable de Portal:
   ```env
   VITE_PORTAL_API_KEY=pk_tu_key_publicable_aqui
   ```
   *Sin esta key, cada pestaña queda aislada: no habrá sincronización entre dispositivos.*

4. **(Opcional) Configurar API Key de Anthropic:**
   Agrega también al `.env` (o a uno separado dentro de `server/`, según cómo despliegues) lo siguiente para habilitar los pensamientos generados en tiempo real por la IA:
   ```env
   PORT=3001
   ANTHROPIC_API_KEY=tu_api_key_aqui
   ```
   *Nota: Si no se proporciona una API Key, el sistema utilizará respuestas predeterminadas de respaldo sin interrumpir el flujo del juego.*

---

## 🛠️ Comandos de Ejecución

### Modo Desarrollo (Local)

1. **Iniciar el servidor Backend:**
   ```bash
   npm run server
   ```
   *El backend estará disponible en: `http://localhost:3001`*

2. **Iniciar la aplicación Frontend (Vite):**
   ```bash
   npm run dev
   ```
   *El frontend estará disponible en: `http://localhost:3000`*

### Compilación para Producción

```bash
npm run build
```

---

## ⚡ Funcionalidades y Eventos de Caos

- **Tablero Kanban Operativo:** Visualiza en tiempo real los pedidos según su etapa (`Recibido`, `Cocinando`, `Empacado`, `En camino`, `Entregado`).
- **Agentes Autónomos:** Cada etapa es procesada por un agente especializado que razona sobre la situación actual.
- **Panel del Host (Simulador de Caos):**
  - **🔥 Falta de ingrediente:** Interrumpe la cocina e impacta los pedidos activos.
  - **📈 Pico de pedidos:** Genera una ráfaga masiva de comandas repentinas.
  - **⚠ Fallo de Agente:** Simula la caída de un agente principal, activando automáticamente el protocolo del **Agente de Respaldo**.
