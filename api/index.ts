import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from "express";
import cors from "cors";
import { registerRoutes } from "../server/routes.js";
import { initializeDatabase } from "../server/db.js";

const app = express();

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize database and register routes
let initialized = false;

async function initialize() {
  if (!initialized) {
    try {
      await initializeDatabase();
      await registerRoutes(app);

      // Error handler
      app.use((err: any, _req: any, res: any, _next: any) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
      });

      initialized = true;
    } catch (error) {
      console.error('Initialization error:', error);
      throw error;
    }
  }
}

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await initialize();
    return app(req as any, res as any);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
