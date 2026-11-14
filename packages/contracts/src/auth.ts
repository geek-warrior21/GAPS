import { z } from "zod";

export const UserRoleSchema = z.enum(["student", "teacher", "staff_admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["pending_consent", "active", "locked", "deleted"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const ConsentScopeSchema = z.enum(["core_learning", "ai_free_text", "research_use"]);
export type ConsentScope = z.infer<typeof ConsentScopeSchema>;

export const ConsentMethodSchema = z.enum(["school_paper", "school_digital"]);
export type ConsentMethod = z.infer<typeof ConsentMethodSchema>;

export const StudentLoginRequestSchema = z.object({
  joinCode: z
    .string()
    .min(4)
    .max(12)
    .transform((s) => s.trim().toUpperCase()),
  username: z
    .string()
    .min(2)
    .max(32)
    .transform((s) => s.trim().toLowerCase()),
  pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
  deviceKind: z.enum(["personal", "shared"]).default("personal"),
});
export type StudentLoginRequest = z.infer<typeof StudentLoginRequestSchema>;

export const StaffLoginRequestSchema = z.object({
  email: z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8),
  totp: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});
export type StaffLoginRequest = z.infer<typeof StaffLoginRequestSchema>;

export const UserProfileDtoSchema = z.object({
  id: z.string(),
  role: UserRoleSchema,
  displayName: z.string(),
  username: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  orgId: z.string().nullable().optional(),
  cohortId: z.string().nullable().optional(),
  cohortName: z.string().nullable().optional(),
  status: UserStatusSchema,
  consents: z.array(ConsentScopeSchema),
  avatar: z.record(z.string(), z.unknown()).default({}),
});
export type UserProfileDto = z.infer<typeof UserProfileDtoSchema>;

export const LoginResponseSchema = z.object({
  user: UserProfileDtoSchema,
  sessionToken: z.string(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RecordConsentRequestSchema = z.object({
  scope: ConsentScopeSchema,
  method: ConsentMethodSchema,
  evidenceRef: z.string().min(3).max(128),
});
export type RecordConsentRequest = z.infer<typeof RecordConsentRequestSchema>;

export const AddStudentRequestSchema = z.object({
  displayName: z.string().min(2).max(64),
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/, "Username must contain only lowercase letters, numbers, and underscores")
    .transform((s) => s.toLowerCase()),
  pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
});
export type AddStudentRequest = z.infer<typeof AddStudentRequestSchema>;

export const ResetPinRequestSchema = z.object({
  newPin: z.string().regex(/^\d{6}$/, "New PIN must be exactly 6 digits"),
});
export type ResetPinRequest = z.infer<typeof ResetPinRequestSchema>;

export const CohortRosterMemberSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  username: z.string(),
  status: UserStatusSchema,
  hasCoreConsent: booleanSchema(),
  hasAiConsent: booleanSchema(),
  sparksTotal: z.number().default(0),
  demonstratedCount: z.number().default(0),
  lastActiveAt: z.string().nullable().optional(),
});
export type CohortRosterMember = z.infer<typeof CohortRosterMemberSchema>;

function booleanSchema() {
  return z.boolean();
}
