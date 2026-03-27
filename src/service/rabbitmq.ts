import amqp from "amqplib";
import { logger } from "../util/logger";

const QUEUE_NAME = "meeting_video_processing";

let channel: amqp.Channel;

export async function connectRabbitMQ() {
  logger.info("Connecting to RabbitMQ");
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL || "amqp://localhost",
  );
  channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: true });

  logger.info("Connected to RabbitMQ and queue asserted", { QUEUE_NAME });
}

export function publishJob(data: any) {
  if (!channel) {
    logger.error("RabbitMQ not initialized. Call connectRabbitMQ first.");
    throw new Error("RabbitMQ not initialized. Call connectRabbitMQ first.");
  }
  logger.info("Publishing job to RabbitMQ", { QUEUE_NAME, data });
  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(data)), {
    persistent: true,
  });
}
