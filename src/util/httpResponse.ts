import { Response } from "express";

export function httpResponse(res: Response, statusCode: number, message: string, data: unknown = null): void {
  res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}
