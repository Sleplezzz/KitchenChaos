import express from "express";
import cors from "cors";
import { config } from "./config.js";
import agentRoutes from "./routes/agentRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", agentRoutes);

app.listen(config.port, () => {
  console.log(`🚀 Kitchen Chaos server corriendo en http://localhost:${config.port}`);
});
