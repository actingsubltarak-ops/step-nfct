import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import admin from "firebase-admin";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

dotenv.config();

// Initialize Firebase Admin for server-side token verification
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

if (firebaseProjectId) {
  try {
    // If no service account key is found, this may still fail verifyIdToken later, 
    // but at least the server starts.
    admin.initializeApp({
      projectId: firebaseProjectId,
    });
  } catch (error) {
    console.warn("Firebase Admin failed to initialize:", error);
  }
} else {
  console.warn("WARNING: Firebase Project ID is not defined. AI endpoints will be insecure or fail.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

// Trust proxy for rate limiting (important on Cloud Run/GCP)
  app.set('trust proxy', 1);

  // Gemini API Key Protection - Server-side only
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    console.warn("WARNING: GEMINI_API_KEY is not defined in environment variables. AI endpoints will fail.");
  }
  const ai = new GoogleGenAI({ apiKey: apiKey || "dummy_key" });

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", 
          "'unsafe-eval'", 
          "https://www.gstatic.com", 
          "https://apis.google.com",
          "https://accounts.google.com",
          "https://*.google.com"
        ],
        connectSrc: [
          "'self'", 
          "*.googleapis.com", 
          "*.firebaseio.com", 
          "https://securetoken.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://accounts.google.com",
          "https://*.google.com",
          "wss://*.firebaseio.com"
        ],
        imgSrc: ["'self'", "data:", "https://lh3.googleusercontent.com", "*.firebasestorage.app", "*.googleusercontent.com", "blob:", "https://*.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://*.google.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameSrc: [
          "https://accounts.google.com",
          "https://*.firebaseapp.com",
          "https://*.google.com"
        ],
        formAction: ["'self'", "https://accounts.google.com", "https://*.google.com"],
        frameAncestors: [
          "'self'", 
          "https://*.google.com", 
          "https://*.googleusercontent.com", 
          "https://*.run.app",
          "https://ai.studio",
          "https://*.ai.studio"
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    frameguard: false,
  }));

  const allowedOrigins = process.env.VITE_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
  app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  }));

  app.use(express.json());

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 200, 
    keyGenerator: (req) => (req as any).user?.uid || req.ip || "anonymous",
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
    validate: false, 
  });
  app.use("/api/", limiter);

  const aiLimiter = rateLimit({
    windowMs: 60 * 1000, 
    max: 10, 
    keyGenerator: (req) => (req as any).user?.uid || req.ip || "anonymous",
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI request limit reached. Please wait a moment." },
    validate: false,
  });
  app.use("/api/ai/", aiLimiter);

  // Gemini is already initialized above

  // Authentication Middleware: Verifies Firebase ID Token
  const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Auth Error:", error);
      res.status(401).json({ error: "Unauthorized: Token verification failed" });
    }
  };

  // Apply authentication to all AI routes
  app.use("/api/ai", authenticate);

  // API Routes
  app.post("/api/ai/summarize", async (req, res) => {
    const { commentsText } = req.body;
    if (!commentsText || typeof commentsText !== 'string' || commentsText.length > 10000) {
      return res.status(400).json({ error: "Invalid input" });
    }
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: `สรุปเนื้อหาการพูดคุยต่อไปนี้ให้สั้น กระชับ และได้ใจความสำคัญสำหรับผู้บริหาร (ภาษาไทย):\n\n${commentsText}` }] }],
        config: {
          systemInstruction: "คุณคือผู้ช่วยบริหารที่เก่งในการสรุปประเด็นสำคัญจากการสนทนาในทีมงาน",
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Summarize API Error:", error);
      res.status(500).json({ error: "AI processing failed" });
    }
  });

  app.post("/api/ai/analyze-priority", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
      return res.status(400).json({ error: "Invalid input" });
    }
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "คุณคือผู้เชี่ยวชาญด้านการบริหารจัดการโครงการ (Project Management Expert) ที่ช่วยวิเคราะห์และจัดลำดับความสำคัญของงาน",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              priority: { type: Type.STRING },
              reason: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              category: { type: Type.STRING }
            },
            required: ["priority", "reason", "tags", "category"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Analyze Priority API Error:", error);
      res.status(500).json({ error: "AI analysis failed" });
    }
  });

  app.post("/api/ai/predict-delay", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 5000) {
      return res.status(400).json({ error: "Invalid input" });
    }
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              probability: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ["probability", "reason"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Predict Delay API Error:", error);
      res.status(500).json({ error: "AI prediction failed" });
    }
  });

  app.post("/api/ai/generic", async (req, res) => {
    const { prompt } = req.body;
    
    // Security Fix: Proper validation and return on failure
    if (!prompt || typeof prompt !== 'string' || prompt.length > 2000) {
      return res.status(400).json({ error: "Invalid input. Prompt must be a string between 1 and 2000 characters." });
    }

    try {
      const response = await ai.models.generateContent({ 
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          systemInstruction: "คุณคือผู้ช่วยอัจฉริยะที่ช่วยจัดการงานในระบบ IT Task Tracking System"
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Generic AI API Error:", error);
      res.status(500).json({ error: "AI processing failed" });
    }
  });

  // Vite middleware - Use only in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("[Server] Vite middleware active.");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else {
    // Production Mode
    if (process.env.VERCEL) {
      console.log("[Server] Production mode (Vercel): API Only (Static files handled by Vercel)");
    } else {
      // Standard Production (e.g., Cloud Run / AI Studio)
      const distPath = path.join(process.cwd(), "dist");
      console.log(`[Server] Production mode (Standard): Serving from ${distPath}`);
      
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Build artifacts not found. Please run 'npm run build' first.");
        }
      });

      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  }

  return app;
}

// For AI Studio / Local / Cloud Run
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer().then(app => {
    // If we're not inside Vercel, the app needs to listen
    // However, in production mode (Standard), the listen was already called inside startServer
    // but only if it's not Vercel. 
    // This part is mostly for local dev where NODE_ENV might be undefined.
  });
}

// For Vercel (must export the promise or the app)
// Vercel @vercel/node supports exporting a promise of an app.
export default startServer();

