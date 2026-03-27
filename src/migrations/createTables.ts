import "dotenv/config";
import pool from "../db/db";

async function createTables() {
  try {
    await pool.query(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    
        `);

    await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
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
          duration NUMERIC,
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
