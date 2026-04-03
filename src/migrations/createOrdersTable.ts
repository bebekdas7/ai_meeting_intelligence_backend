import "dotenv/config";
import pool from "../db/db";

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      razorpay_order_id VARCHAR(255) NOT NULL,
      razorpay_payment_id VARCHAR(255),
      razorpay_signature VARCHAR(255),
      amount INTEGER NOT NULL,
      currency VARCHAR(10) NOT NULL,
      receipt VARCHAR(255),
      status VARCHAR(50) DEFAULT 'created',
      notes JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.end();
  console.log("Migration complete: orders table created.");
}

migrate().catch(console.error);
