import "dotenv/config";
import pool from "../db/db";

async function addSubscriptionFields() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS free_used INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false;
    `);
    console.log(
      "Migration: Added free_used, credits, is_subscribed to users table.",
    );
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

addSubscriptionFields();
