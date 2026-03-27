import { Router } from "express";
import { signupController, loginController } from "../controller/authController";
import { validate } from "../middleware/validate";
import { signupSchema, loginSchema } from "../util/validators";
import rateLimit from "express-rate-limit";

const loginLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 5,
	message: { error: "Too many login attempts, please try again later." },
	standardHeaders: true,
	legacyHeaders: false,
});

const authRouter = Router();

authRouter.post("/signup", validate(signupSchema), signupController);
authRouter.post("/login", loginLimiter, validate(loginSchema), loginController);

export default authRouter;
