import { Router } from "express";
import {
  createOrderController,
  verifyPaymentController,
} from "../controller/paymentController";
import {
  getCurrentUserCreditHistory,
  getCurrentUserCredits,
  getCurrentUserSubscription,
  getMeetingsRemainingEstimate,
} from "../controller/meetingController";
import { authenticate } from "../middleware/authMiddleware";

const apiRouter = Router();

// Payment order creation endpoint (requires authentication)
apiRouter.post("/payment/create-order", authenticate, createOrderController);

// Payment verification endpoint (requires authentication)
apiRouter.post("/payment/verify", authenticate, verifyPaymentController);

// Get available credits for the logged-in user
apiRouter.get("/payment/credits", authenticate, getCurrentUserCredits);

// Get meetings remaining estimate for the logged-in user
apiRouter.get(
  "/payment/credits/estimate",
  authenticate,
  getMeetingsRemainingEstimate,
);

// Get paginated credit transaction history for the logged-in user
apiRouter.get(
  "/payment/credits/history",
  authenticate,
  getCurrentUserCreditHistory,
);

// Get current subscription details for the logged-in user
apiRouter.get(
  "/payment/subscription",
  authenticate,
  getCurrentUserSubscription,
);

export default apiRouter;
