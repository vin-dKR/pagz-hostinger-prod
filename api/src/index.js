import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import redoc from "redoc-express";
import swaggerUi from "swagger-ui-express";
import yaml from "js-yaml";

import authRoutes from "./routes/auth.js";
import publicRoutes from "./routes/public.js";
import customerRoutes from "./routes/customer.js";
import adminRoutes from "./routes/admin.js";
import paymentRoutes from "./routes/payment.js";
import cartRoutes from "./routes/cart.js";
import wishlistRoutes from "./routes/wishlist.js";
import reviewRoutes from "./routes/reviews.js";
import couponRoutes from "./routes/coupons.js";
import webhookRoutes from "./routes/webhook.js";
import uploadRoutes from "./routes/upload.js";
import ftpRoutes from "./routes/ftp.js";

import { errorHandler } from "./middleware/errorHandler.js";
import { checkDatabaseConnection } from "./utils/db-utils.js";

const app = express();
const PORT = process.env.PORT || 3002;

// CORS configuration
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "https://print-e-com-web.vercel.app",
    "https://admin-pagz.vercel.app",
    "https://pagz.vercel.app",
    "https://slateblue-lapwing-350500.hostingersite.com",
    "https://silver-fish-590311.hostingersite.com",
    "https://pagz.in",
    "https://admin.pagz.in",
    // Allow additional origins from environment variable (comma-separated)
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim()) : []),
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true, // Allow cookies and authorization headers
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
// WIP: not in use now
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Serve OpenAPI YAML spec (for Redoc UI)
app.get("/api/openapi.yaml", (_req, res) => {
    try {
        const specPath = path.join(process.cwd(), "openapi.yaml");
        if (fs.existsSync(specPath)) {
            const yamlContent = fs.readFileSync(specPath, "utf8");
            res.type("text/yaml").send(yamlContent);
        } else {
            res.status(404).json({ error: "OpenAPI spec not found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to load OpenAPI spec" });
    }
});

// Serve API documentation UI at /api/docs using Redoc
app.get(
    "/api/docs",
    redoc({
        title: "Custom Printing E-commerce API Docs",
        specUrl: "/api/openapi.yaml"
    })
);

// Load OpenAPI spec once for Swagger UI (with error handling)
let openapiDocument = null;
try {
    const openapiSpecPath = path.join(process.cwd(), "openapi.yaml");
    if (fs.existsSync(openapiSpecPath)) {
        openapiDocument = yaml.load(fs.readFileSync(openapiSpecPath, "utf8"));
    }
} catch (error) {
    console.warn("Failed to load OpenAPI spec for Swagger UI:", error);
}

// Interactive API playground using Swagger UI
if (openapiDocument) {
    app.use("/api/playground", swaggerUi.serve, swaggerUi.setup(openapiDocument));
} else {
    app.get("/api/playground", (_req, res) => {
        res.status(503).json({ error: "OpenAPI spec not available" });
    });
}

app.get("/", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        message: "Custom Printing E-commerce API"
    });
});

app.get("/health", async (_req, res) => {
    const dbConnected = await checkDatabaseConnection();
    res.json({
        status: dbConnected ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        database: dbConnected ? "connected" : "disconnected",
    });
});

// API routes - Order matters! More specific routes before broader ones
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", publicRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/payment", paymentRoutes);
// Webhooks (public endpoints called by Razorpay, etc.)
app.use("/api/webhooks", webhookRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/coupons", couponRoutes);
app.use("/api/v1/customer", customerRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/ftp", ftpRoutes);

app.use(errorHandler);

const server = app.listen(PORT, () => {
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please stop the other process or use a different port.`);
        console.error(`   To find and kill the process: lsof -ti:${PORT} | xargs kill -9`);
    } else {
        console.error('❌ Failed to start server:', error.message);
    }
    process.exit(1);
});
