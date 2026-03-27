import { NextFunction, Request, Response } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { AppError } from "../util/errorObject";
import { logger } from "../util/logger";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// PostgreSQL error codes (pg driver attaches a `code` property to DatabaseError)
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_NOT_NULL_VIOLATION = "23502";
const PG_INVALID_INPUT_SYNTAX = "22P02";

interface ErrorResponseBody {
  success: false;
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
  stack?: string;
}

function buildErrorBody(
  statusCode: number,
  message: string,
  req: Request,
  stack?: string,
): ErrorResponseBody {
  const body: ErrorResponseBody = {
    success: false,
    statusCode,
    message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };
  if (!IS_PRODUCTION && stack) {
    body.stack = stack;
  }
  return body;
}

function logError(statusCode: number, message: string, err: unknown): void {
  if (statusCode >= 500) {
    logger.error(`[ERROR ${statusCode}] ${message}`, err);
  } else if (!IS_PRODUCTION) {
    logger.warn(`[WARN ${statusCode}] ${message}`);
  }
}

// Type guard for pg DatabaseError
function isPostgresError(
  err: unknown,
): err is { code: string; detail?: string; constraint?: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as Record<string, unknown>).code === "string"
  );
}

function handlePostgresError(err: { code: string; detail?: string }): {
  statusCode: number;
  message: string;
} {
  switch (err.code) {
    case PG_UNIQUE_VIOLATION:
      return {
        statusCode: 409,
        message: "A resource with that value already exists.",
      };
    case PG_FOREIGN_KEY_VIOLATION:
      return { statusCode: 409, message: "Related resource not found." };
    case PG_NOT_NULL_VIOLATION:
      return { statusCode: 400, message: "A required field is missing." };
    case PG_INVALID_INPUT_SYNTAX:
      return { statusCode: 400, message: "Invalid input format." };
    default:
      console.error("[DATABASE ERROR]", err);
      return { statusCode: 500, message: "A database error occurred." };
  }
}

// Express requires the 4-argument signature to recognise this as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // 1. Operational errors thrown via AppError / httpError()
  if (err instanceof AppError) {
    logError(err.statusCode, err.message, err);
    // User-friendly error message for client, developer message in stack
    res
      .status(err.statusCode)
      .json(
        buildErrorBody(
          err.statusCode,
          userFriendlyMessage(err.message),
          req,
          err.stack,
        ),
      );
    return;
  }

  // 2. JWT – expired token
  if (err instanceof TokenExpiredError) {
    res
      .status(401)
      .json(
        buildErrorBody(401, "Token has expired. Please log in again.", req),
      );
    return;
  }

  // 3. JWT – invalid / malformed token
  if (err instanceof JsonWebTokenError) {
    res.status(401).json(buildErrorBody(401, "Invalid token.", req));
    return;
  }

  // 4. Malformed JSON body (SyntaxError injected by express.json())
  if (err instanceof SyntaxError && "body" in err) {
    res
      .status(400)
      .json(buildErrorBody(400, "Malformed JSON in request body.", req));
    return;
  }

  // 5. PostgreSQL errors
  if (isPostgresError(err)) {
    const { statusCode, message } = handlePostgresError(err);
    logError(statusCode, message, err);
    res
      .status(statusCode)
      .json(buildErrorBody(statusCode, userFriendlyMessage(message), req));
    return;
  }

  // 6. Unknown / programmer errors — never leak internals in production
  const message =
    !IS_PRODUCTION && err instanceof Error
      ? err.message
      : "Something went wrong. Please try again later.";
  const stack = err instanceof Error ? err.stack : undefined;
  logError(500, message, err);
  res
    .status(500)
    .json(buildErrorBody(500, userFriendlyMessage(message), req, stack));
}

// Map internal error messages to user-friendly ones
function userFriendlyMessage(msg: string): string {
  if (/not found/i.test(msg)) return "The requested resource was not found.";
  if (/unauthorized|token/i.test(msg))
    return "You are not authorized to perform this action.";
  if (/already exists|duplicate/i.test(msg))
    return "A resource with this value already exists.";
  if (/required|missing/i.test(msg))
    return "A required field is missing or invalid.";
  if (/invalid/i.test(msg)) return "Invalid input. Please check your data.";
  if (/database|db|sql|pg/i.test(msg))
    return "A server error occurred. Please try again later.";
  if (/video/i.test(msg)) return "Only video uploads are allowed.";
  // Default fallback
  return "Something went wrong. Please try again later.";
}
