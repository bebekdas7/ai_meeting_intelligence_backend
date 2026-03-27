import { AppError } from "./errorObject";

/**
 * Throws an AppError. Use inside route handlers to signal operational errors.
 * Express 5 will automatically forward thrown errors to the global error handler.
 */
export function httpError(message: string, statusCode: number): never {
  throw new AppError(message, statusCode);
}
