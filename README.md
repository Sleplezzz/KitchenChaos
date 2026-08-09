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
