import meetingRouter from "./router/meetingRouter";
import authRouter from "./router/authRouter";
import actionItemRouter from "./router/actionItemRouter";
import apiRouter from "./router/apiRouter";
import express, { Application, NextFunction, Request, Response } from "express";
import { globalErrorHandler } from "./middleware/globalErrorHandler";
import { AppError } from "./util/errorObject";
import rateLimit from "express-rate-limit";
import cors from "cors";

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const app: Application = express();
const allowedOrigins = [
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:5174",
  "https://meeting-insights-hub.onrender.com",
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// Handle preflight for all routes
app.options(/.*/, cors());
app.use(express.json());
app.use(generalLimiter);

// Health check
app.get("/", (_req: Request, res: Response) => {
  res.json({ success: true, message: "API is running" });
});

// Mount routers (rate limits are applied in the router files)
app.use("/api/auth", authRouter);
app.use("/api/meetings", meetingRouter);
app.use("/api/action-items", actionItemRouter);
app.use("/api", apiRouter);

// 404 handler — must be after all routers
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(
    new AppError(`Route ${_req.method} ${_req.originalUrl} not found.`, 404),
  );
});

// Global error handler — must be last and must have exactly 4 arguments
app.use(globalErrorHandler);

export default app;
