import "dotenv/config";
import pool from "../db/db";

async function createTables() {
  try {
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // -- USERS TABLE (lightweight, no credits)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        current_plan VARCHAR(50) DEFAULT 'free',
        plan_expiry TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // -- ORDERS TABLE (with plan, credits, expiry, metadata)
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
        plan VARCHAR(50),
        credits INTEGER,
        expiry TIMESTAMPTZ,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // -- CREDIT TRANSACTIONS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        type VARCHAR(10) NOT NULL, -- 'credit' or 'debit'
        amount INTEGER NOT NULL,
        source VARCHAR(50), -- 'purchase', 'meeting_usage', etc.
        reference_id VARCHAR(255), -- order_id or meeting_id
        expiry TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        video_path TEXT,
        audio_path TEXT,
        transcript TEXT,
        summary TEXT,
        status VARCHAR(50),
        title TEXT,
        duration FLOAT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_items (
        id SERIAL PRIMARY KEY,
        meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
        task TEXT,
        assignee VARCHAR(255),
        status VARCHAR(50)
      );
    `);
  } catch (err) {
    console.error("Error creating tables:", err);
  } finally {
    await pool.end();
  }
}

createTables();
