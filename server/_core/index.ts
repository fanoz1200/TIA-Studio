import "dotenv/config";
import express from "express";
import { createServer, type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

export async function startServer(): Promise<Server> {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.TIA_DESKTOP_LOCAL === "1" ? "127.0.0.1" : "0.0.0.0";
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("error", onError);
      reject(error);
    };

    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      console.log(`Server running on http://${host}:${port}/`);
      resolve();
    });
  });

  return server;
}

if (process.env.TIA_DESKTOP_EMBEDDED !== "1") {
  startServer().catch(console.error);
}
