import express from "express";
import helmet from "helmet";

import { healthRouter } from "./routes/health.js";
import { chatRouter } from "./routes/chat.js";
import { pricesRouter } from "./routes/prices.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(express.json({ limit: "50kb" }));

  app.get("/", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "clinic-chatbot-backend",
    });
  });

  app.use("/health", healthRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/clinic/prices", pricesRouter);
  app.use(errorHandler);

  return app;
}