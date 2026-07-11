import "dotenv/config";
import app from "./app";
import pool from "./db/db";
import { connectRabbitMQ } from "./service/rabbitmq";

const PORT = process.env.PORT || 5000;

async function start() {
  console.log("Starting server...");
  
  // Test database connection
  try {
    console.log("Checking database connection...");
    const result = await pool.query("SELECT NOW()");
    console.log("Database connected successfully at:", result.rows[0].now);
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }

  console.log("Connecting to RabbitMQ...");
  await connectRabbitMQ();
  console.log("Connected to RabbitMQ, starting Express server...");

  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
