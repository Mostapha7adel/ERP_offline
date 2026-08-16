import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  email: z.string().email("Invalid email address").optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});

export const principalDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  roleId: z.string(),
  roleName: z.string(),
  permissions: z.array(z.string()),
});

export const loginResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    tokenType: z.literal("Bearer"),
    mustChangePassword: z.boolean().optional(),
    needsSetup: z.boolean().optional(),
    user: principalDataSchema,
  }),
});

export const refreshResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.string(),
    tokenType: z.literal("Bearer"),
    mustChangePassword: z.boolean().optional(),
    needsSetup: z.boolean().optional(),
    user: principalDataSchema,
  }),
});

export const meResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    sub: z.string(),
    email: z.string(),
    name: z.string(),
    roleId: z.string(),
    roleName: z.string(),
    permissions: z.array(z.string()),
  }),
});

export const simpleSuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({ success: z.boolean() }),
});

export const changePasswordResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    success: z.boolean(),
    email: z.string(),
    accessToken: z.string(),
  }),
});

export const completeSetupResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    success: z.boolean(),
    accessToken: z.string(),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
