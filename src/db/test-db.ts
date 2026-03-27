import "dotenv/config";
import pool from "./db";

async function testConnection() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("Database connected successfully");
    console.log(res.rows[0]);
  } catch (err) {
    console.error("Database connection failed:", err);
  } finally {
    await pool.end();
  }
}

testConnection();


// npx ts-node src/db/test-db.ts