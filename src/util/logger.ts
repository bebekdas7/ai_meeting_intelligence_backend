// Utility to filter sensitive fields from objects
const SENSITIVE_KEYS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "auth",
  "jwt",
  "secret",
];

export function filterSensitive(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(filterSensitive);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      SENSITIVE_KEYS.includes(k.toLowerCase()) ? k : k,
      SENSITIVE_KEYS.includes(k.toLowerCase())
        ? "[FILTERED]"
        : filterSensitive(v),
    ]),
  );
}
import winston from "winston";
import path from "path";
import DailyRotateFile from "winston-daily-rotate-file";
import type { Request } from "express";
import type { Logger } from "winston";

// Color mapping for modules (for reference/documentation)
// Used for log colorization in the console via the module property
// (actual colorization is handled by your terminal/theme)
// const moduleColors: Record<string, string> = {
//   auth: "magenta",
//   meeting: "cyan",
//   action: "green",
//   rabbitmq: "yellow",
//   worker: "blue",
//   default: "white",
// };

// Custom format to colorize by module
const colorizeByModule = winston.format((info) => {
  const moduleName = typeof info.module === "string" ? info.module : "default";
  // Colorize the message, not the level (to avoid winston colorize issues)
  info.message = `[${moduleName.toUpperCase()}] ${info.message}`;
  return info;
});

winston.addColors({
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue",
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    colorizeByModule(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `[${timestamp}] ${level}: ${message}\n${stack}`
        : `[${timestamp}] ${level}: ${message}`,
    ),
  ),
  transports: [
    new winston.transports.Console(),
    // Rotate error logs daily, keep 14 days, compress old logs
    new DailyRotateFile({
      filename: path.join("logs", "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "14d",
      zippedArchive: true,
    }),
    // Rotate combined logs daily, keep 14 days, compress old logs
    new DailyRotateFile({
      filename: path.join("logs", "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      zippedArchive: true,
    }),
  ],
});

/**
 * Logs a detailed error for controller actions.
 * @param logger - Winston logger instance
 * @param context - Short string for the action (e.g. "Signup failed")
 * @param error - The error object
 * @param req - Express request object
 * @param extra - Any extra context (optional)
 */
export function logControllerError(
  logger: Logger,
  context: string,
  error: unknown,
  req: Request,
  extra: Record<string, unknown> = {},
) {
  logger.error(context, {
    error,
    stack: error instanceof Error ? error.stack : undefined,
    reqBody: filterSensitive(req.body),
    reqParams: req.params,
    reqQuery: req.query,
    reqUser:
      req && typeof req === "object" && "user" in req
        ? filterSensitive((req as any).user)
        : undefined,
    ...extra,
  });
}
