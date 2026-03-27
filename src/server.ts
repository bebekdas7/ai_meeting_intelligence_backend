import "dotenv/config";
import app from "./app";
import { connectRabbitMQ } from "./service/rabbitmq";

const PORT = process.env.PORT || 5000;

async function start() {
  console.log("Starting server...");
  console.log("Rabbit URL:", process.env.RABBITMQ_URL);
  
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
