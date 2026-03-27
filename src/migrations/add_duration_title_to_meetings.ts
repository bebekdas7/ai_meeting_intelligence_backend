import pool from "../db/db";

async function addDurationAndTitleColumns() {
  try {
    await pool.query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration FLOAT;`);
    await pool.query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS title TEXT;`);
    console.log("Added duration and title columns to meetings table.");
  } catch (err) {
    console.error("Error adding columns to meetings table:", err);
  } finally {
    await pool.end();
  }
}

addDurationAndTitleColumns();
