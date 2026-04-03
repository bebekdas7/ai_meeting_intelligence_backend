export type PlanName = "free" | "one_time" | "starter" | "pro";

export interface PlanConfig {
  credits: number;
  expiryDays: number | null; // null = no expiry (free plan)
}

type PaidPlanName = Exclude<PlanName, "free">;

const PLAN_AMOUNT_ENV_KEYS: Record<PaidPlanName, string> = {
  one_time: "PLAN_ONE_TIME_AMOUNT_PAISE",
  starter: "PLAN_STARTER_AMOUNT_PAISE",
  pro: "PLAN_PRO_AMOUNT_PAISE",
};

export const PLANS: Record<PlanName, PlanConfig> = {
  free: { credits: 2, expiryDays: null },
  one_time: { credits: 1, expiryDays: 30 },
  starter: { credits: 25, expiryDays: 30 },
  pro: { credits: 100, expiryDays: 30 },
};

export function normalizePlanName(value: unknown): PlanName | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "free") return "free";
  if (normalized === "one_time" || normalized === "onetime") return "one_time";
  if (normalized === "starter") return "starter";
  if (normalized === "pro") return "pro";

  return null;
}

export function getPlanExpiry(plan: PlanName): Date | null {
  const config = PLANS[plan];
  if (!config || config.expiryDays === null) return null;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + config.expiryDays);
  return expiry;
}

export function getPlanCredits(plan: PlanName): number {
  return PLANS[plan]?.credits ?? 0;
}

function parsePlanAmount(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

export function getPlanAmountPaise(plan: PlanName): number | null {
  if (plan === "free") return 0;

  const envKey = PLAN_AMOUNT_ENV_KEYS[plan];
  return parsePlanAmount(process.env[envKey]);
}
