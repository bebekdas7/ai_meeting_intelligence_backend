import { Request, Response } from "express";
import { signup, login } from "../service/authService";
import { SignupInput, LoginInput } from "../util/validators";
import { httpResponse } from "../util/httpResponse";
import { logger, logControllerError } from "../util/logger";

export async function signupController(
  req: Request,
  res: Response,
): Promise<void> {
  logger.info("Signup request received", { email: req.body?.email });
  try {
    const { email, password } = req.body as SignupInput;
    const user = await signup(email, password);
    logger.info("User signed up successfully", { userId: user.id });
    httpResponse(res, 201, "Signup successful", { user });
  } catch (error) {
    logControllerError(logger, "Signup failed", error, req);
    const message = error instanceof Error ? error.message : "Signup failed";
    res.status(400).json({ error: message });
  }
}

export async function loginController(
  req: Request,
  res: Response,
): Promise<void> {
  logger.info("Login request received", { email: req.body?.email });
  try {
    const { email, password } = req.body as LoginInput;
    const result = await login(email, password);
    logger.info("User logged in successfully", { userId: result.user.id });
    httpResponse(res, 200, "Login successful", result);
  } catch (error) {
    logControllerError(logger, "Login failed", error, req);
    const message = error instanceof Error ? error.message : "Login failed";
    res.status(401).json({ error: message });
  }
}
