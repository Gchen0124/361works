import express from 'express';
import cors from 'cors';
import { registerRoutes } from '../server/routes.js';
import { initializeDatabase } from '../server/db.js';

const app = express();

// Enable CORS
const corsOptions = {
  origin: true,
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize database and register routes
let initialized = false;

async function initialize() {
  if (!initialized) {
    await initializeDatabase();
    await registerRoutes(app);
    initialized = true;
  }
}

// Vercel serverless function handler
export default async function handler(req, res) {
  await initialize();
  return app(req, res);
}
