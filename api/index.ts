import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "../server/routes";
import { initializeDatabase } from "../server/db";

const app = express();

// Enable CORS
const allowAllCors = process.env.ALLOW_ALL_CORS === "1" || process.env.ALLOW_ALL_CORS === "true";
const corsOptions =
  allowAllCors || process.env.NODE_ENV === "development"
    ? { origin: true, credentials: true }
    : {
        origin: true, // Allow all origins in production for now
        credentials: true,
      };
app.use(cors(corsOptions));

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
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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
export default async function handler(req: any, res: any) {
  try {
    await initialize();
    return app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
