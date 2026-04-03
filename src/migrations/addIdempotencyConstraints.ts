import "dotenv/config";
import pool from "../db/db";

async function addIdempotencyConstraints() {
  try {
    // Check if the unique constraint already exists before adding
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
      console.log("Added unique constraint on orders.razorpay_payment_id");
    } else {
      console.log(
        "Constraint orders_razorpay_payment_id_unique already exists, skipping.",
      );
    }

    // CREATE UNIQUE INDEX supports IF NOT EXISTS natively
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS credit_txn_unique_purchase_reference
      ON credit_transactions (source, reference_id)
      WHERE source = 'purchase';
    `);
    console.log(
      "Ensured unique partial index on credit_transactions for purchase source",
    );
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await pool.end();
  }
}

addIdempotencyConstraints();
