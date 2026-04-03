import "dotenv/config";
import pool from "../db/db";
import { PlanName } from "../config/plans";

export interface Order {
  id?: number;
  user_id?: string | null;
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
  plan?: PlanName | undefined;
  credits?: number | undefined;
  expiry?: Date | null | undefined;
  metadata?: any;
  created_at?: Date;
  updated_at?: Date;
}

export async function createOrder(order: Order): Promise<Order> {
  const result = await pool.query(
    `INSERT INTO orders (user_id, razorpay_order_id, amount, currency, receipt, status, plan, credits, expiry, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      order.user_id || null,
      order.razorpay_order_id,
      order.amount,
      order.currency,
      order.receipt || null,
      order.status || "created",
      order.plan || null,
      order.credits || null,
      order.expiry || null,
      order.metadata ? JSON.stringify(order.metadata) : null,
    ],
  );
  return result.rows[0];
}

/**
 * Update order payment fields only if the order is not already marked as paid.
 * Returns the updated row, or null if the order was already paid (idempotent guard).
 */
export async function updateOrderPayment(
  orderId: number,
  paymentId: string,
  signature: string,
  status: string,
): Promise<Order | null> {
  const result = await pool.query(
    `UPDATE orders
     SET razorpay_payment_id = $1, razorpay_signature = $2, status = $3, updated_at = NOW()
     WHERE id = $4 AND status != 'paid'
     RETURNING *`,
    [paymentId, signature, status, orderId],
  );
  return result.rows[0] || null;
}

export async function getOrderByRazorpayOrderId(
  razorpay_order_id: string,
): Promise<Order | null> {
  const result = await pool.query(
    `SELECT * FROM orders WHERE razorpay_order_id = $1`,
    [razorpay_order_id],
  );
  return result.rows[0] || null;
}
