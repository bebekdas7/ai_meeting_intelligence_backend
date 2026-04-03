import pool from "../db/db";
import { PlanName } from "../config/plans";

export interface ExpiringPlanUser {
  id: string;
  name: string;
  email: string;
  current_plan: PlanName;
  plan_expiry: Date;
}

async function createUser(name: string, email: string, passwordHash: string) {
  const result = await pool.query(
    `INSERT INTO users(name, email, password_hash, current_plan)
     VALUES ($1, $2, $3, 'free')
     RETURNING id, name, email, current_plan, plan_expiry, created_at`,
    [name, email, passwordHash],
  );
  return result.rows[0];
}

async function findUserByEmail(email: string) {
  const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [
    email,
  ]);
  return result.rows[0];
}

async function findUserById(userId: string) {
  const result = await pool.query(`SELECT * FROM users WHERE id = $1`, [
    userId,
  ]);
  return result.rows[0];
}

async function updateUserPlan(
  userId: string,
  plan: PlanName,
  planExpiry: Date | null,
) {
  const result = await pool.query(
    `UPDATE users SET current_plan = $1, plan_expiry = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [plan, planExpiry, userId],
  );
  return result.rows[0];
}

async function findUsersWithPlanExpiringBetween(
  from: Date,
  to: Date,
): Promise<ExpiringPlanUser[]> {
  const result = await pool.query(
    `SELECT id, name, email, current_plan, plan_expiry
     FROM users
     WHERE current_plan <> 'free'
       AND plan_expiry IS NOT NULL
       AND plan_expiry >= $1
       AND plan_expiry < $2
     ORDER BY plan_expiry ASC`,
    [from, to],
  );

  return result.rows;
}

async function findUsersWithExpiredPaidPlan(
  now: Date,
): Promise<ExpiringPlanUser[]> {
  const result = await pool.query(
    `SELECT id, name, email, current_plan, plan_expiry
     FROM users
     WHERE current_plan <> 'free'
       AND plan_expiry IS NOT NULL
       AND plan_expiry <= $1
     ORDER BY plan_expiry ASC`,
    [now],
  );

  return result.rows;
}

export default {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserPlan,
  findUsersWithPlanExpiringBetween,
  findUsersWithExpiredPaidPlan,
};
