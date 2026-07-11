import "dotenv/config";
import pool from "../db/db";

async function runAllMigrations() {
  console.log("🚀 Starting Database Migrations...\n");

  try {
    // 1. Create UUID extension
    console.log("📦 Step 1: Creating UUID extension...");
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);
    console.log("✅ UUID extension created\n");

    // 2. Create Users table
    console.log("📦 Step 2: Creating users table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        current_plan VARCHAR(50) DEFAULT 'free',
        plan_expiry TIMESTAMPTZ,
        free_used INTEGER DEFAULT 0,
        credits INTEGER DEFAULT 0,
        is_subscribed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ Users table created\n");

    // 3. Create Orders table
    console.log("📦 Step 3: Creating orders table...");
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
    console.log("✅ Orders table created\n");

    // 4. Create Credit Transactions table
    console.log("📦 Step 4: Creating credit_transactions table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id),
        type VARCHAR(10) NOT NULL,
        amount INTEGER NOT NULL,
        source VARCHAR(50),
        reference_id VARCHAR(255),
        expiry TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ Credit transactions table created\n");

    // 5. Create Meetings table
    console.log("📦 Step 5: Creating meetings table...");
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
    console.log("✅ Meetings table created\n");

    // 6. Create Action Items table
    console.log("📦 Step 6: Creating action_items table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action_items (
        id SERIAL PRIMARY KEY,
        meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
        task TEXT,
        assignee VARCHAR(255),
        status VARCHAR(50)
      );
    `);
    console.log("✅ Action items table created\n");

    // 7. Add idempotency constraints
    console.log("📦 Step 7: Adding idempotency constraints...");
    const constraintCheck = await pool.query(`
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_name = 'orders'
        AND constraint_name = 'orders_razorpay_payment_id_unique';
    `);

    if (constraintCheck.rowCount === 0) {
      await pool.query(`
        ALTER TABLE orders
        ADD CONSTRAINT orders_razorpay_payment_id_unique
        UNIQUE (razorpay_payment_id);
      `);
      console.log("✅ Added unique constraint on orders.razorpay_payment_id");
    } else {
      console.log("ℹ️  Constraint already exists, skipping");
    }

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS credit_txn_unique_purchase_reference
      ON credit_transactions (source, reference_id)
      WHERE source = 'purchase';
    `);
    console.log("✅ Added unique partial index on credit_transactions\n");

    console.log("✨ All migrations completed successfully!");
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAllMigrations();
