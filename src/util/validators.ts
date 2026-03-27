import { z } from "zod";

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .check(z.email({ error: "Invalid email format" })),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long")
    .max(128, "Password must be at most 128 characters long"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .check(z.email({ error: "Invalid email format" })),
  password: z.string().min(1, "Password is required"),
});

export const createActionItemSchema = z.object({
  meetingId: z.string().min(1, "meetingId is required"),
  task: z.string().min(1, "task is required"),
  assignee: z.string().optional(),
});

export const updateActionItemSchema = z
  .object({
    status: z.string().optional(),
    assignee: z.string().optional(),
  })
  .refine((data) => data.status || data.assignee, {
    message: "At least one of status or assignee is required",
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateActionItemInput = z.infer<typeof createActionItemSchema>;
export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;
