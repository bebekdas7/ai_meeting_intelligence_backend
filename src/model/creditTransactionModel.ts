import "dotenv/config";
import pool from "../db/db";

export interface CreditTransaction {
  id?: number;
  user_id: string;
  type: "credit" | "debit";
  amount: number;
  source: "purchase" | "meeting_usage" | "signup_free" | "expiry_maintenance";
  reference_id?: string; // order_id or meeting_id
  expiry?: Date | null;
  created_at?: Date;
}

export interface CreditTransactionHistoryResult {
  rows: CreditTransaction[];
  total: number;
}

export async function insertCreditTransaction(
  tx: CreditTransaction,
): Promise<CreditTransaction | null> {
  const result = await pool.query(
    `INSERT INTO credit_transactions (user_id, type, amount, source, reference_id, expiry)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (source, reference_id) WHERE source = 'purchase' DO NOTHING
     RETURNING *`,
    [
      tx.user_id,
      tx.type,
      tx.amount,
      tx.source,
      tx.reference_id || null,
      tx.expiry || null,
    ],
  );
  // Returns null if duplicate was silently ignored
  return result.rows[0] || null;
}

export async function getAvailableCredits(userId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(
      CASE WHEN type = 'credit' THEN amount ELSE -amount END
    ), 0) AS available
     FROM credit_transactions
     WHERE user_id = $1
       AND (expiry IS NULL OR expiry > NOW())`,
    [userId],
  );
  return parseInt(result.rows[0].available, 10);
}

export async function getCreditTransactionHistory(
  userId: string,
  page: number,
  limit: number,
): Promise<CreditTransactionHistoryResult> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const offset = (safePage - 1) * safeLimit;

  const [rowsResult, totalResult] = await Promise.all([
    pool.query(
      `SELECT id, user_id, type, amount, source, reference_id, expiry, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, offset],
    ),
    pool.query(
      `SELECT COUNT(*)::INT AS total
       FROM credit_transactions
       WHERE user_id = $1`,
      [userId],
    ),
  ]);

  return {
    rows: rowsResult.rows,
    total: totalResult.rows[0]?.total ?? 0,
  };
}
