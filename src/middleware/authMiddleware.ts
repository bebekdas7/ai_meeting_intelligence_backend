import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  getJwtAudience,
  getJwtIssuer,
  getJwtSecret,
  JWT_ALGORITHM,
} from "../config/config";
import { AuthTokenPayload } from "../types/types";

function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: "Authorization header missing" });
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Invalid authorization format" });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
      audience: getJwtAudience(),
      issuer: getJwtIssuer(),
    });

    if (
      typeof decoded === "string" ||
      !decoded.userId ||
      !decoded.email ||
      !decoded.role
    ) {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    req.user = decoded as AuthTokenPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
}

export { authenticate };
