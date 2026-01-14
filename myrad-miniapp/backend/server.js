import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import config from "./config.js";
import mvpRoutes from "./mvpRoutes.js";
import { initializeSchema } from "./dbSchema.js";
import { testConnection } from "./dbConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { PORT } = config;

const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: false
}));

// ========================================
// BODY PARSING WITH ERROR HANDLING
// ========================================

// Parse raw binary bodies (for any content type not caught by others)
app.use(express.raw({ limit: "50mb", type: "*/*" }));

// Parse raw text bodies (Reclaim webhooks may send text/plain)
app.use(express.text({ limit: "50mb", type: "text/*" }));

// Parse JSON bodies
app.use(express.json({ limit: "50mb" }));

// Parse URL-encoded bodies
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Error handler for body parsing failures (catches the 400 errors)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.status === 400) {
    console.error('❌ Body parsing error:', err.message);
    console.error('❌ Content-Type:', req.headers['content-type']);
    console.error('❌ Path:', req.path);

    // For Reclaim callback, try to continue with empty body
    if (req.path.includes('/reclaim/callback')) {
      console.log('⚠️ Continuing Reclaim callback with raw body');
      req.body = req.body || {};
      return next();
    }

    return res.status(400).json({
      error: 'Invalid request body',
      message: err.message
    });
  }
  next(err);
});

// Middleware to convert Buffer/string body to JSON for Reclaim callbacks
app.use('/api/reclaim/callback', (req, res, next) => {
  console.log('🔍 Reclaim callback - Raw body type:', typeof req.body);
  console.log('🔍 Reclaim callback - Content-Type:', req.headers['content-type']);

  // If body is a Buffer, convert to string first
  if (Buffer.isBuffer(req.body)) {
    try {
      const str = req.body.toString('utf-8');
      req.body = JSON.parse(str);
      console.log('✅ Parsed Buffer body as JSON');
    } catch (e) {
      console.log('⚠️ Could not parse Buffer as JSON, trying as string');
      req.body = { raw: req.body.toString('utf-8') };
    }
  }
  // If body is a string, try to parse as JSON
  else if (typeof req.body === 'string' && req.body.trim()) {
    try {
      req.body = JSON.parse(req.body);
      console.log('✅ Parsed string body as JSON');
    } catch (e) {
      // Try URL-decoding first if it's encoded
      try {
        req.body = JSON.parse(decodeURIComponent(req.body));
        console.log('✅ Parsed URL-decoded body as JSON');
      } catch (e2) {
        console.log('⚠️ Could not parse as JSON, keeping as object');
        req.body = { rawString: req.body };
      }
    }
  }
  next();
});

// Serve static frontend files from 'dist' folder (production build)
app.use(express.static(path.join(__dirname, "../dist"), {
  dotfiles: 'allow'
}));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.0.0"
  });
});


// MVP API Routes
app.use("/api", mvpRoutes);

// Note: In development, Vite serves the frontend. 
// The catchall route is only needed in production when serving built frontend.

// Initialize database schema on startup
(async function startServer() {
  try {
    // Test database connection
    const connected = await testConnection();
    if (connected) {
      // Initialize schema (creates tables if they don't exist)
      await initializeSchema();
    } else {
      console.warn('⚠️  Database connection failed - continuing without database');
    }
  } catch (error) {
    console.error('⚠️  Database initialization error:', error.message);
    console.warn('⚠️  Continuing without database - some features may not work');
  }

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`🚀 MYRAD Backend API listening at http://localhost:${PORT}`);
    console.log(`📊 MVP Routes: /api/*`);
    console.log(`🏥 Health check: /health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Process terminated');
    });
  });
})();
