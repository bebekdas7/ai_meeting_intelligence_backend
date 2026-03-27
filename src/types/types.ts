import { JwtPayload } from "jsonwebtoken";

export interface AuthTokenPayload extends JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export {};
