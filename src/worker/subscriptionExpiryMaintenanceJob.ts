import "dotenv/config";
import userModel from "../model/userModel";
import {
  getAvailableCredits,
  insertCreditTransaction,
} from "../model/creditTransactionModel";
import { logger } from "../util/logger";

const RUN_INTERVAL_HOURS = Number(
  process.env.EXPIRY_MAINTENANCE_INTERVAL_HOURS ?? 24,
);

async function runExpiryMaintenanceJob() {
  const now = new Date();

  logger.info("[SubscriptionExpiryMaintenance] Running expiry maintenance", {
    now: now.toISOString(),
  });

  const users = await userModel.findUsersWithExpiredPaidPlan(now);

  if (users.length === 0) {
    logger.info("[SubscriptionExpiryMaintenance] No expired paid plans found");
    return;
  }

  let processedCount = 0;

  for (const user of users) {
    const availableCredits = await getAvailableCredits(user.id);

    if (availableCredits > 0) {
      await insertCreditTransaction({
        user_id: user.id,
        type: "debit",
        amount: availableCredits,
        source: "expiry_maintenance",
        reference_id: `expiry-reset:${user.id}:${new Date().toISOString().slice(0, 10)}`,
        expiry: null,
      });
    }

    await userModel.updateUserPlan(user.id, "free", null);

    processedCount += 1;
    logger.info("[SubscriptionExpiryMaintenance] Expired plan processed", {
      userId: user.id,
      previousPlan: user.current_plan,
      previousPlanExpiry: user.plan_expiry,
      creditsExpired: Math.max(0, availableCredits),
    });
  }

  logger.info("[SubscriptionExpiryMaintenance] Maintenance run complete", {
    expiredUsersProcessed: processedCount,
  });
}

async function startExpiryMaintenanceWorker() {
  logger.info("[SubscriptionExpiryMaintenance] Worker started", {
    intervalHours: RUN_INTERVAL_HOURS,
  });

  try {
    await runExpiryMaintenanceJob();
  } catch (error) {
    logger.error("[SubscriptionExpiryMaintenance] Initial run failed", {
      error,
    });
  }

  const intervalMs = RUN_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      await runExpiryMaintenanceJob();
    } catch (error) {
      logger.error("[SubscriptionExpiryMaintenance] Scheduled run failed", {
        error,
      });
    }
  }, intervalMs);
}

startExpiryMaintenanceWorker().catch((error) => {
  logger.error("[SubscriptionExpiryMaintenance] Worker crashed", { error });
  process.exit(1);
});
