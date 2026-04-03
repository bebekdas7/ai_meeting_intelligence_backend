import "dotenv/config";
import userModel from "../model/userModel";
import { logger } from "../util/logger";

const ALERT_DAYS_BEFORE_EXPIRY = Number(
  process.env.EXPIRY_ALERT_DAYS_BEFORE ?? 3,
);
const RUN_INTERVAL_HOURS = Number(
  process.env.EXPIRY_ALERT_INTERVAL_HOURS ?? 24,
);

function getExpiryWindow(daysBefore: number) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() + daysBefore);

  const to = new Date(from);
  to.setDate(to.getDate() + 1);

  return { from, to };
}

async function runExpiryAlertJob() {
  const { from, to } = getExpiryWindow(ALERT_DAYS_BEFORE_EXPIRY);

  logger.info("[SubscriptionExpiryAlert] Running expiry alert scan", {
    from: from.toISOString(),
    to: to.toISOString(),
    daysBefore: ALERT_DAYS_BEFORE_EXPIRY,
  });

  const users = await userModel.findUsersWithPlanExpiringBetween(from, to);

  if (users.length === 0) {
    logger.info("[SubscriptionExpiryAlert] No plans expiring in alert window");
    return;
  }

  for (const user of users) {
    logger.warn("[SubscriptionExpiryAlert] Plan expiring soon", {
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.current_plan,
      planExpiry: user.plan_expiry,
      daysBefore: ALERT_DAYS_BEFORE_EXPIRY,
    });
  }

  logger.info("[SubscriptionExpiryAlert] Alert scan complete", {
    expiringCount: users.length,
  });
}

async function startExpiryAlertWorker() {
  logger.info("[SubscriptionExpiryAlert] Worker started", {
    intervalHours: RUN_INTERVAL_HOURS,
    daysBefore: ALERT_DAYS_BEFORE_EXPIRY,
  });

  try {
    await runExpiryAlertJob();
  } catch (error) {
    logger.error("[SubscriptionExpiryAlert] Initial run failed", { error });
  }

  const intervalMs = RUN_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      await runExpiryAlertJob();
    } catch (error) {
      logger.error("[SubscriptionExpiryAlert] Scheduled run failed", { error });
    }
  }, intervalMs);
}

startExpiryAlertWorker().catch((error) => {
  logger.error("[SubscriptionExpiryAlert] Worker crashed", { error });
  process.exit(1);
});
