# Billing + Credit System Checklist

Use this marking system:

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked

Last updated: 2026-04-03

## Phase 0: Foundation (Completed)

- [x] Create normalized plans config (`free`, `one_time`, `starter`, `pro`)
- [x] Add `credit_transactions` table for credit/debit ledger
- [x] Update orders schema to include plan, credits, expiry, metadata
- [x] Update payment verification to insert credit transactions
- [x] Add endpoint to fetch current user available credits

## Phase 1: Reliability and Correctness (Do Next)

- [x] Add payment idempotency (avoid double crediting if verify is retried)
- [ ] Add Razorpay webhook endpoint (`payment.captured`, `payment.failed`, `refund.processed`)
- [ ] Add signature verification for webhook events
- [ ] Add webhook event storage table for replay/debug
- [ ] Add refund flow that reverses credits via debit transaction
- [x] Validate amount server-side from plan catalog (do not trust UI amount)

## Phase 2: Credit Lifecycle

- [x] Add endpoint: user credit transaction history (paginated)
- [x] Add endpoint: current subscription details (plan, expiry, status)
- [x] Add endpoint: meetings remaining estimate
- [x] Add expiry alert job (3 days before expiry)
- [x] Add daily expiry maintenance job (mark state only, no deletes)

## Phase 3: Plan Management

- [ ] Add plan upgrade flow (starter -> pro)
- [ ] Add downgrade policy (next-cycle switch)
- [ ] Add one-time top-up packs
- [ ] Add grace period support (optional)
- [ ] Move plan pricing/limits to DB-managed catalog

## Phase 4: UX + Admin

- [ ] Show current plan, credits, and expiry in pricing UI
- [ ] Add purchase history page
- [ ] Add invoice/receipt download endpoint
- [ ] Add admin dashboard (MRR, active subs, credit usage)
- [ ] Add manual credit adjustment admin action with reason logs

## Phase 5: Ops + Monitoring

- [ ] Add reconciliation job: paid orders vs credit ledger consistency
- [ ] Add alerting for worker queue backlog and consumer crashes
- [ ] Add structured audit logs for all billing actions
- [ ] Add integration tests for payment -> credit -> meeting deduction flow

## Quick Working Rules

- [x] Never delete expired billing/credit records
- [x] Always derive available credits from credit ledger
- [x] Keep users table lightweight (current_plan, plan_expiry)
- [x] Every billing mutation must be idempotent

## Change Log

- [x] 2026-04-03: Initial checklist created
- [x] 2026-04-03: Implemented payment idempotency (conditional order update, ON CONFLICT credit insert, early-return guard in verify controller)
- [x] 2026-04-03: Implemented server-side amount validation for create-order (plan amount must match catalog)
- [x] 2026-04-03: Added paginated credit transaction history endpoint (/api/meetings/credits/history)
- [x] 2026-04-03: Added current subscription details endpoint (/api/meetings/subscription)
- [x] 2026-04-03: Added meetings remaining estimate endpoint (/api/meetings/credits/estimate)
- [x] 2026-04-03: Added subscription expiry alert worker job (3-day alert window)
- [x] 2026-04-03: Added daily subscription expiry maintenance worker (marks expired plans as free and debits remaining credits to 0)
