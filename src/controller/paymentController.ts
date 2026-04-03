import { Request, Response, NextFunction } from "express";
import { createRazorpayOrder } from "../service/razorpayService";
import { createOrder } from "../model/orderModel";

import crypto from "crypto";
import {
  getOrderByRazorpayOrderId,
  updateOrderPayment,
} from "../model/orderModel";
import { logger } from "../util/logger";
import {
  getPlanAmountPaise,
  getPlanCredits,
  getPlanExpiry,
  normalizePlanName,
} from "../config/plans";
import { insertCreditTransaction } from "../model/creditTransactionModel";
import userModel from "../model/userModel";

export async function createOrderController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { amount, currency, receipt, notes } = req.body;
    const plan = normalizePlanName(req.body.plan ?? notes?.plan);
    const requestedAmount = Number(amount);

    if (!amount || !currency || !receipt) {
      res
        .status(400)
        .json({ error: "amount, currency, and receipt are required" });
      return;
    }

    if (!plan) {
      res.status(400).json({
        error:
          "A valid plan is required. Supported plans: free, one_time, starter, pro",
      });
      return;
    }

    if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
      res.status(400).json({
        error: "amount must be a positive integer in paise",
      });
      return;
    }

    if (plan === "free") {
      res.status(400).json({
        error: "Free plan does not require payment order creation",
      });
      return;
    }

    const expectedAmount = getPlanAmountPaise(plan);
    if (expectedAmount === null) {
      logger.error(`Missing or invalid configured price for plan ${plan}`);
      res.status(500).json({
        error: `Server plan pricing is not configured for plan ${plan}`,
      });
      return;
    }

    if (requestedAmount !== expectedAmount) {
      logger.warn(
        `Amount validation failed for user ${req.user?.userId || "unknown"}, plan ${plan}. Requested=${requestedAmount}, Expected=${expectedAmount}`,
      );
      res.status(400).json({
        error: "Amount does not match plan pricing",
        expectedAmount,
      });
      return;
    }

    logger.info(
      `Creating order for user: ${req.user?.userId || "unknown"}, plan: ${plan}`,
    );
    const user_id = req.user?.userId || null;

    // Derive credits and expiry from plan
    const credits = getPlanCredits(plan);
    const expiry = getPlanExpiry(plan);

    const razorpayOrder = await createRazorpayOrder({
      amount: expectedAmount,
      currency,
      receipt,
      notes,
    });

    const dbOrder = await createOrder({
      user_id,
      razorpay_order_id: razorpayOrder.id,
      amount: expectedAmount,
      currency,
      receipt,
      status: razorpayOrder.status || "created",
      plan,
      credits,
      expiry,
      metadata: notes,
    });

    res.status(201).json({ success: true, order: razorpayOrder, dbOrder });
    return;
  } catch (error) {
    next(error);
    return;
  }
}

// Razorpay payment verification
export async function verifyPaymentController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({
        error:
          "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      });
      return;
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET as string;
    const generated_signature = crypto
      .createHmac("sha256", key_secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    const dbOrder = await getOrderByRazorpayOrderId(razorpay_order_id);
    if (!dbOrder) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Idempotency guard: if this exact payment was already verified, return success immediately
    if (
      dbOrder.status === "paid" &&
      dbOrder.razorpay_payment_id === razorpay_payment_id
    ) {
      logger.info(
        `Payment already verified for order ${razorpay_order_id}, skipping`,
      );
      res
        .status(200)
        .json({ success: true, message: "Payment already verified" });
      return;
    }

    // If order is paid but with a DIFFERENT payment ID, something is wrong
    if (
      dbOrder.status === "paid" &&
      dbOrder.razorpay_payment_id !== razorpay_payment_id
    ) {
      logger.warn(
        `Order ${razorpay_order_id} already paid with different payment ID`,
      );
      res
        .status(409)
        .json({ error: "Order already settled with a different payment" });
      return;
    }

    if (generated_signature === razorpay_signature) {
      // 1. Mark order as paid (conditional — no-op if already paid)
      const updatedOrder = await updateOrderPayment(
        dbOrder.id!,
        razorpay_payment_id,
        razorpay_signature,
        "paid",
      );

      const userId = dbOrder.user_id;
      const plan = normalizePlanName(dbOrder.plan);

      // Only run credit + plan update if the order was freshly updated
      if (updatedOrder && userId && plan) {
        const credits = dbOrder.credits ?? getPlanCredits(plan);
        const expiry = dbOrder.expiry ?? getPlanExpiry(plan);

        // 2. Insert credit transaction (idempotent — ignored if duplicate purchase reference)
        const inserted = await insertCreditTransaction({
          user_id: userId,
          type: "credit",
          amount: credits,
          source: "purchase",
          reference_id: String(dbOrder.id),
          expiry,
        });

        // 3. Update user's current plan and plan_expiry
        await userModel.updateUserPlan(userId, plan, expiry);

        logger.info(
          `Plan updated for user ${userId}: ${plan}, credits: ${credits}, tx inserted: ${!!inserted}`,
        );
      }

      res.status(200).json({ success: true, message: "Payment verified" });
    } else {
      await updateOrderPayment(
        dbOrder.id!,
        razorpay_payment_id,
        razorpay_signature,
        "failed",
      );
      res.status(400).json({ success: false, error: "Invalid signature" });
    }
    return;
  } catch (error) {
    next(error);
    return;
  }
}
