import type { Adventure, ContextBuildResult, ProviderUsage } from "../../src/types/adventure";

export type AccountStatus = "pending_verification" | "active" | "disabled";
export type AccountRole = "user" | "admin";
export type AuthProvider = "password" | "google";
export type RestrictionLevel = "none" | "watched" | "restricted" | "generation_hold" | "banned";
export type PolicyGate = "input" | "context" | "output" | "memoryWrite" | "import" | "share" | "profile";
export type PolicyAction = "allow" | "review_only" | "redact" | "quarantine" | "block";

export interface BackendUser {
  id: string;
  email: string;
  displayName: string;
  role?: AccountRole;
  status: AccountStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthIdentity {
  id: string;
  userId: string;
  provider: AuthProvider;
  providerSubject: string;
  email: string;
  createdAt: string;
}

export interface PasswordCredential {
  userId: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InviteLink {
  id: string;
  tokenHash: string;
  createdAt: string;
  expiresAt?: string;
  maxUses: number;
  useCount: number;
  createdByUserId?: string;
  note?: string;
  disabledAt?: string;
}

export interface SignupIntent {
  id: string;
  inviteId: string;
  email: string;
  provider: AuthProvider;
  status: "pending" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface VerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  purpose: "emailVerification" | "passwordReset";
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface OAuthStateRecord {
  id: string;
  provider: "google";
  tokenHash: string;
  inviteId?: string;
  returnTo?: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface BackendAdventureRecord {
  id: string;
  ownerUserId: string;
  adventure: Adventure;
  createdAt: string;
  updatedAt: string;
}

export interface AdventureSnapshotRecord {
  id: string;
  adventureId: string;
  userId: string;
  source: "import" | "turn" | "manualSave" | "restore";
  adventure: Adventure;
  createdAt: string;
}

export interface ContextBuildEvent {
  id: string;
  userId: string;
  adventureId: string;
  gate: "preview" | "turn";
  context: ContextBuildResult;
  createdAt: string;
}

export interface PolicyDecisionRecord {
  id: string;
  userId?: string;
  subjectType?: string;
  subjectId?: string;
  gate: PolicyGate;
  action: PolicyAction;
  matchedRuleIds: string[];
  categories: string[];
  severity: number;
  manualReviewRequired: boolean;
  rationale: string;
  createdAt: string;
}

export interface AccountSafetyEvent {
  id: string;
  userId: string;
  policyDecisionId: string;
  category: string;
  severity: number;
  gate: PolicyGate;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
}

export interface AccountRestriction {
  id: string;
  userId: string;
  level: RestrictionLevel;
  reason: string;
  sharingDisabled: boolean;
  generationDisabled: boolean;
  contextTokenCap?: number;
  createdAt: string;
  reviewedAt?: string;
}

export interface AccountStatusHistory {
  id: string;
  userId: string;
  fromLevel: RestrictionLevel;
  toLevel: RestrictionLevel;
  reason: string;
  createdAt: string;
}

export interface ScenarioDraft {
  id: string;
  ownerUserId: string;
  title: string;
  description: string;
  sourceAdventureId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioRevision {
  id: string;
  scenarioId: string;
  ownerUserId: string;
  version: number;
  title: string;
  description: string;
  content: unknown;
  status: "draft" | "published" | "quarantined";
  createdAt: string;
  publishedAt?: string;
}

export interface ShareLink {
  id: string;
  ownerUserId: string;
  targetType: "scenarioRevision" | "adventure";
  targetId: string;
  tokenHash: string;
  publicSlug?: string;
  createdAt: string;
  disabledAt?: string;
}

export interface UsageLog {
  id: string;
  userId: string;
  adventureId: string;
  providerName: string;
  model: string;
  usage?: ProviderUsage;
  createdAt: string;
}

export interface AdminAction {
  id: string;
  adminUserId?: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  createdAt: string;
}

export interface PlatformSettingsRecord {
  id: string;
  key: "platform";
  value: unknown;
  updatedAt: string;
  updatedByUserId?: string;
}

export interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: string;
}

export interface LocalDbData {
  schemaVersion: number;
  migrations: MigrationRecord[];
  users: BackendUser[];
  profiles: UserProfile[];
  authIdentities: AuthIdentity[];
  passwordCredentials: PasswordCredential[];
  inviteLinks: InviteLink[];
  signupIntents: SignupIntent[];
  sessions: SessionRecord[];
  verificationTokens: VerificationToken[];
  oauthStates: OAuthStateRecord[];
  adventures: BackendAdventureRecord[];
  adventureSnapshots: AdventureSnapshotRecord[];
  contextBuildEvents: ContextBuildEvent[];
  policyDecisions: PolicyDecisionRecord[];
  accountSafetyEvents: AccountSafetyEvent[];
  accountRestrictions: AccountRestriction[];
  accountStatusHistory: AccountStatusHistory[];
  scenarioDrafts: ScenarioDraft[];
  scenarioRevisions: ScenarioRevision[];
  shareLinks: ShareLink[];
  usageLogs: UsageLog[];
  adminActions: AdminAction[];
  platformSettings: PlatformSettingsRecord[];
}
