# MARKETNIORA — Reconciled Prisma Schema + Forward Migration 008+

**Mode:** DESIGN / READ-ONLY

**Repository or live DB modifications:** NONE

**Migrations executed:** NONE

**Live DB authority:** Supabase `lrbgicuzlhgnfplnmvre`

**Normative product source:** `docs/MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md`

**Governance records:** `docs/odr/ODR-2026-001.md`, `docs/odr/ODR-2026-002.md`

## 1. Authority and design decisions

1. The deployed database architecture in Supabase is authoritative for the current DB shape and migration lineage.
2. Blueprint v1.1 is authoritative for what the product must become.
3. Repository Prisma is a target contract and must be reconciled forward to the live architecture; it is not allowed to overwrite the live baseline.
4. Live migrations 001-007 are immutable historical baseline. They are never edited, dropped, reset, or rewritten.
5. New changes begin at migration 008 and are forward-only.
6. Existing live objects remain in `governance_layer`, `production_layer`, and `staging_enrichment`.
7. New application-control objects live in `public` only for the application control plane; direct client access is denied by RLS and explicit grants/revokes. Server-side access is the authority.
8. QC views and `resolve_identity_conflict()` remain SQL migration-only objects rather than Prisma-managed models.
9. C5 status defaults are intentionally NOT invented. New rows must supply all four status dimensions. Migration 008 refuses to enforce NOT NULL if pre-existing rows exist, so a deterministic backfill can be designed explicitly rather than silently guessing.
10. ODR-2026-001 means there is no `password_hash` field anywhere in the target application identity model.
11. Stock Group is a separate registry/aggregation structure, not a Market Classification hierarchy level.
12. Theme hierarchy is THEME -> SUB-THEME -> INDUSTRY -> STOCK. Company is not a Theme level.

---

# 2. Reconciled Prisma schema — full target text

```prisma
generator client {
  provider       = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["public", "governance_layer", "production_layer", "staging_enrichment"]
}

// ============================================================
// PUBLIC APPLICATION CONTROL PLANE
// ============================================================

enum IdentityRole {
  USER
  ADMIN
  OWNER

  @@schema("public")
}

enum AuditActorType {
  OWNER
  ADMIN
  USER
  AI_AGENT
  SYSTEM

  @@schema("public")
}

model AppUser {
  userId                  String                  @id @default(uuid()) @db.Uuid @map("user_id")
  oidcIssuer              String                  @map("oidc_issuer")
  oidcSubject             String                  @map("oidc_subject")
  email                   String                  @unique
  emailVerified           Boolean                 @map("email_verified")
  role                    IdentityRole             @default(USER)
  createdAt               DateTime                @default(now()) @db.Timestamptz(6) @map("created_at")
  updatedAt               DateTime                @updatedAt @db.Timestamptz(6) @map("updated_at")
  lastLoginAt             DateTime?               @db.Timestamptz(6) @map("last_login_at")
  disabledAt              DateTime?               @db.Timestamptz(6) @map("disabled_at")

  sessions                Session[]
  entitlements            Entitlement[]
  ownerTotpSecret         OwnerTotpSecret?
  ownerMfaChallenges      OwnerMfaChallenge[]
  featurePoliciesUpdated  FeaturePolicy[]         @relation("FeaturePolicyUpdater")
  approvedFormulaVersions FormulaVersion[]         @relation("FormulaApprover")
  appAuditLogs            AppAuditLog[]           @relation("AppAuditActor")
  governanceAuditLogs     GovernanceAuditLog[]    @relation("GovernanceAuditActor")

  @@unique([oidcIssuer, oidcSubject])
  @@index([role])
  @@map("app_user")
  @@schema("public")
}

model Session {
  sessionId       String    @id @default(uuid()) @db.Uuid @map("session_id")
  userId          String    @db.Uuid @map("user_id")
  tokenHash       Bytes     @unique @db.Bytea @map("token_hash")
  createdAt       DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")
  lastSeenAt      DateTime? @db.Timestamptz(6) @map("last_seen_at")
  expiresAt       DateTime  @db.Timestamptz(6) @map("expires_at")
  revokedAt       DateTime? @db.Timestamptz(6) @map("revoked_at")

  user            AppUser   @relation(fields: [userId], references: [userId], onDelete: Restrict)

  @@index([userId, expiresAt])
  @@index([userId, revokedAt])
  @@map("session")
  @@schema("public")
}

model Entitlement {
  entitlementId  String    @id @default(uuid()) @db.Uuid @map("entitlement_id")
  userId         String    @db.Uuid @map("user_id")
  tier           String
  source         String
  status         String
  paymentRef     String?   @map("payment_ref")
  startsAt       DateTime  @db.Timestamptz(6) @map("starts_at")
  endsAt         DateTime? @db.Timestamptz(6) @map("ends_at")
  createdAt      DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")
  updatedAt      DateTime  @updatedAt @db.Timestamptz(6) @map("updated_at")
  revokedAt      DateTime? @db.Timestamptz(6) @map("revoked_at")

  user           AppUser   @relation(fields: [userId], references: [userId], onDelete: Restrict)

  @@index([userId, status])
  @@index([userId, startsAt, endsAt])
  @@map("entitlement")
  @@schema("public")
}

model FeaturePolicy {
  featurePolicyId  String    @id @default(uuid()) @db.Uuid @map("feature_policy_id")
  featureKey       String    @unique @map("feature_key")
  enabled          Boolean
  updatedByUserId  String?   @db.Uuid @map("updated_by_user_id")
  reason           String?
  createdAt        DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")
  updatedAt        DateTime  @updatedAt @db.Timestamptz(6) @map("updated_at")

  updatedBy        AppUser?  @relation("FeaturePolicyUpdater", fields: [updatedByUserId], references: [userId], onDelete: Restrict)

  @@index([updatedByUserId])
  @@map("feature_policy")
  @@schema("public")
}

model FormulaVersion {
  formulaVersionId      String           @id @default(uuid()) @db.Uuid @map("formula_version_id")
  formulaKey            String           @map("formula_key")
  version               String
  formulaHash           String           @map("formula_hash")
  configurationSnapshot Json?            @map("configuration_snapshot")
  ownerApprovedByUserId String?          @db.Uuid @map("owner_approved_by_user_id")
  ownerApprovedAt       DateTime?        @db.Timestamptz(6) @map("owner_approved_at")
  lockedAt              DateTime?        @db.Timestamptz(6) @map("locked_at")
  supersedesVersionId   String?          @db.Uuid @map("supersedes_version_id")
  createdAt             DateTime         @default(now()) @db.Timestamptz(6) @map("created_at")

  ownerApprovedBy       AppUser?         @relation("FormulaApprover", fields: [ownerApprovedByUserId], references: [userId], onDelete: Restrict)
  supersedes             FormulaVersion?  @relation("FormulaLineage", fields: [supersedesVersionId], references: [formulaVersionId], onDelete: Restrict)
  successors             FormulaVersion[] @relation("FormulaLineage")
  rotationScores         RotationScore[]
  stockScores            StockScore[]
  rawObservations        RawStockObservation[]

  @@unique([formulaKey, version])
  @@index([formulaKey, lockedAt])
  @@map("formula_version")
  @@schema("public")
}

model OwnerTotpSecret {
  userId           String    @id @db.Uuid @map("user_id")
  secretCiphertext Bytes     @db.Bytea @map("secret_ciphertext")
  kmsKeyRef        String    @map("kms_key_ref")
  keyVersion       String?   @map("key_version")
  confirmedAt      DateTime? @db.Timestamptz(6) @map("confirmed_at")
  createdAt        DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")
  rotatedAt        DateTime? @db.Timestamptz(6) @map("rotated_at")
  disabledAt       DateTime? @db.Timestamptz(6) @map("disabled_at")

  user             AppUser   @relation(fields: [userId], references: [userId], onDelete: Restrict)

  @@map("owner_totp_secret")
  @@schema("public")
}

model OwnerMfaChallenge {
  challengeId      String    @id @default(uuid()) @db.Uuid @map("challenge_id")
  userId           String    @db.Uuid @map("user_id")
  challengeHash    Bytes     @db.Bytea @map("challenge_hash")
  attempts         Int       @default(0)
  createdAt        DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")
  expiresAt        DateTime  @db.Timestamptz(6) @map("expires_at")
  consumedAt       DateTime? @db.Timestamptz(6) @map("consumed_at")

  user             AppUser   @relation(fields: [userId], references: [userId], onDelete: Restrict)

  @@index([userId, expiresAt])
  @@index([userId, consumedAt])
  @@map("owner_mfa_challenge")
  @@schema("public")
}

model AppAuditLog {
  auditId    String         @id @default(uuid()) @db.Uuid @map("audit_id")
  actorType  AuditActorType @map("actor_type")
  actorId    String?        @db.Uuid @map("actor_id")
  action     String
  targetType String?        @map("target_type")
  targetId   String?        @map("target_id")
  metadata   Json?          @map("metadata")
  createdAt  DateTime       @default(now()) @db.Timestamptz(6) @map("created_at")

  actor      AppUser?       @relation("AppAuditActor", fields: [actorId], references: [userId], onDelete: Restrict)

  @@index([actorId, createdAt])
  @@index([action, createdAt])
  @@map("app_audit_log")
  @@schema("public")
}

// ============================================================
// GOVERNANCE LAYER — LIVE 001-007 OBJECTS
// Existing CHECK constraints, RLS policies, views and functions
// remain SQL migration concerns.
// ============================================================

model GovernanceAuditLog {
  auditId     BigInt    @id @default(autoincrement()) @db.BigInt @map("audit_id")
  actorUserId String?   @db.Uuid @map("actor_user_id")
  action      String
  targetType  String?   @map("target_type")
  targetId    String?   @map("target_id")
  metadata    Json      @default(dbgenerated("'{}'::jsonb"))
  createdAt   DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")

  actorUser   AppUser? @relation("GovernanceAuditActor", fields: [actorUserId], references: [userId], onDelete: Restrict)

  @@map("audit_log")
  @@schema("governance_layer")
}

model MasterImportBatch {
  batchId           String               @id @default(uuid()) @db.Uuid @map("batch_id")
  sourceName        String               @map("source_name")
  sourceHash        String?              @map("source_hash")
  status            String
  ownerAuthorizedAt DateTime?            @db.Timestamptz(6) @map("owner_authorized_at")
  createdAt         DateTime             @default(now()) @db.Timestamptz(6) @map("created_at")

  identityConflicts IdentityConflict[]
  sourceEvidence    SourceEvidence[]
  classificationReviews ClassificationReview[]

  @@map("master_import_batch")
  @@schema("governance_layer")
}

model IdentityConflict {
  conflictId    String           @id @default(uuid()) @db.Uuid @map("conflict_id")
  batchId       String           @db.Uuid @map("batch_id")
  exchange      String
  symbol        String
  status        String
  resolutionNote String?         @map("resolution_note")
  resolvedAt    DateTime?        @db.Timestamptz(6) @map("resolved_at")

  batch         MasterImportBatch @relation(fields: [batchId], references: [batchId], onDelete: Restrict)
  sourceEvidence SourceEvidence[]

  @@unique([batchId, exchange, symbol])
  @@index([batchId, status])
  @@map("identity_conflict")
  @@schema("governance_layer")
}

model IdentityResolutionRequest {
  id                        String    @id @default(uuid()) @db.Uuid
  symbol                    String
  conflictType              String    @map("conflict_type")
  evidenceUrl               String?   @map("evidence_url")
  proposedCanonicalIdentity String    @map("proposed_canonical_identity")
  proposedIsin              String?   @map("proposed_isin")
  impactOn4187Rows          String    @map("impact_on_4187_rows")
  state                     String
  ownerDecision             String?   @map("owner_decision")
  ownerDecidedAt            DateTime? @db.Timestamptz(6) @map("owner_decided_at")
  ownerNote                 String?   @map("owner_note")
  createdAt                 DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")

  @@index([symbol])
  @@index([state])
  @@map("identity_resolution_requests")
  @@schema("governance_layer")
}

model ProviderRegistry {
  providerId   String         @id @default(uuid()) @db.Uuid @map("provider_id")
  providerName String         @unique @map("provider_name")
  providerType String         @map("provider_type")
  status       String         @default("NOT_CONFIGURED")
  baseUrl      String?        @map("base_url")
  secretRef    String?        @map("secret_ref")
  createdAt    DateTime       @default(now()) @db.Timestamptz(6) @map("created_at")
  updatedAt    DateTime       @updatedAt @db.Timestamptz(6) @map("updated_at")

  sourceHealth SourceHealth[]

  @@map("provider_registry")
  @@schema("governance_layer")
}

model SourceHealth {
  healthId    String          @id @default(uuid()) @db.Uuid @map("health_id")
  providerId  String          @db.Uuid @map("provider_id")
  checkedAt   DateTime        @default(now()) @db.Timestamptz(6) @map("checked_at")
  healthy     Boolean
  latencyMs   Int?            @map("latency_ms")
  errorCode   String?         @map("error_code")
  details     Json            @default(dbgenerated("'{}'::jsonb"))

  provider    ProviderRegistry @relation(fields: [providerId], references: [providerId], onDelete: Restrict)

  @@index([providerId, checkedAt])
  @@map("source_health")
  @@schema("governance_layer")
}

model SourceEvidence {
  evidenceId  String            @id @default(uuid()) @db.Uuid @map("evidence_id")
  batchId     String?           @db.Uuid @map("batch_id")
  conflictId  String?           @db.Uuid @map("conflict_id")
  evidenceType String           @map("evidence_type")
  sourceName  String            @map("source_name")
  sourceUrl   String?           @map("source_url")
  observedAt  DateTime?         @db.Timestamptz(6) @map("observed_at")
  claim       String
  status      String            @default("PROPOSED")
  createdAt   DateTime          @default(now()) @db.Timestamptz(6) @map("created_at")

  batch       MasterImportBatch? @relation(fields: [batchId], references: [batchId], onDelete: Restrict)
  conflict    IdentityConflict?  @relation(fields: [conflictId], references: [conflictId], onDelete: Restrict)
  classificationReviews ClassificationReview[]

  @@index([conflictId])
  @@map("source_evidence")
  @@schema("governance_layer")
}

model ClassificationReview {
  reviewId       String          @id @default(uuid()) @db.Uuid @map("review_id")
  batchId        String?         @db.Uuid @map("batch_id")
  symbol         String
  companyName    String?         @map("company_name")
  issueType      String          @map("issue_type")
  proposedAction String?         @map("proposed_action")
  status         String          @default("OPEN")
  evidenceId     String?         @db.Uuid @map("evidence_id")
  createdAt      DateTime        @default(now()) @db.Timestamptz(6) @map("created_at")

  batch          MasterImportBatch? @relation(fields: [batchId], references: [batchId], onDelete: Restrict)
  evidence       SourceEvidence?    @relation(fields: [evidenceId], references: [evidenceId], onDelete: Restrict)

  @@index([batchId, status])
  @@map("classification_review")
  @@schema("governance_layer")
}

// ============================================================
// PRODUCTION LAYER — LIVE BASELINE + RECONCILED DOMAIN
// ============================================================

enum FreshnessStatus {
  LIVE
  DELAYED
  STALE
  UNAVAILABLE

  @@schema("production_layer")
}

enum VerificationStatus {
  VERIFIED
  UNKNOWN

  @@schema("production_layer")
}

enum InterpretationStatus {
  NOT_INTERPRETABLE
  INTERPRETABLE

  @@schema("production_layer")
}

enum WorkflowStatus {
  SOURCE_REQUIRED
  PENDING
  MISSING

  @@schema("production_layer")
}

model CanonicalStock {
  stockId        String                   @id @default(uuid()) @db.Uuid @map("stock_id")
  name           String
  symbol         String
  exchange       String
  identityKey    String                   @unique @map("identity_key")
  sector         String?
  subSector      String?                  @map("sub_sector")
  createdAt      DateTime                 @default(now()) @db.Timestamptz(6) @map("created_at")
  updatedAt      DateTime                 @updatedAt @db.Timestamptz(6) @map("updated_at")

  classification StockClassification?
  groupMemberships StockGroupMembership[]
  themeMemberships StockThemeMembership[]
  valueChainStages ValueChainStage[]
  observations   RawStockObservation[]
  stockScores    StockScore[]
  shariahStatus  ShariahStatus?

  @@index([symbol])
  @@index([exchange])
  @@map("canonical_stock")
  @@schema("production_layer")
}

model RawStockObservation {
  observationId       String                @id @default(uuid()) @db.Uuid @map("observation_id")
  stockId             String?               @db.Uuid @map("stock_id")
  source              String
  sourceTimestamp     DateTime?             @db.Timestamptz(6) @map("source_timestamp")
  reportedDate        DateTime?             @db.Date @map("reported_date")
  dataNature          String                @map("data_nature")
  formulaVersion      String?               @map("formula_version")
  payload             Json
  createdAt           DateTime              @default(now()) @db.Timestamptz(6) @map("created_at")
  freshnessStatus     FreshnessStatus       @map("freshness_status")
  verificationStatus  VerificationStatus    @map("verification_status")
  interpretationStatus InterpretationStatus  @map("interpretation_status")
  workflowStatus      WorkflowStatus        @map("workflow_status")
  retrievedAt         DateTime?             @db.Timestamptz(6) @map("retrieved_at")
  validationStatus    String?               @map("validation_status")
  configurationSnapshot Json?               @map("configuration_snapshot")
  formulaVersionId    String?               @db.Uuid @map("formula_version_id")

  stock               CanonicalStock?       @relation(fields: [stockId], references: [stockId], onDelete: Restrict)
  formulaVersionRef   FormulaVersion?       @relation(fields: [formulaVersionId], references: [formulaVersionId], onDelete: Restrict)

  @@index([stockId])
  @@index([source, sourceTimestamp])
  @@index([workflowStatus, verificationStatus])
  @@map("raw_stock_observation")
  @@schema("production_layer")
}

model Sector {
  sectorId      String        @id @default(uuid()) @db.Uuid @map("sector_id")
  name          String        @unique
  subSectors    SubSector[]
  rotationScores RotationScore[]

  @@map("sector")
  @@schema("production_layer")
}

model SubSector {
  subSectorId   String        @id @default(uuid()) @db.Uuid @map("sub_sector_id")
  sectorId      String        @db.Uuid @map("sector_id")
  name          String

  sector        Sector        @relation(fields: [sectorId], references: [sectorId], onDelete: Restrict)
  classifications StockClassification[]
  rotationScores RotationScore[]

  @@unique([sectorId, name])
  @@map("sub_sector")
  @@schema("production_layer")
}

model StockClassification {
  stockId       String        @id @db.Uuid @map("stock_id")
  subSectorId   String        @db.Uuid @map("sub_sector_id")
  verifiedAt    DateTime?     @db.Timestamptz(6) @map("verified_at")
  source        String?

  stock         CanonicalStock @relation(fields: [stockId], references: [stockId], onDelete: Restrict)
  subSector     SubSector      @relation(fields: [subSectorId], references: [subSectorId], onDelete: Restrict)

  @@map("stock_classification")
  @@schema("production_layer")
}

model StockGroup {
  groupId       String               @id @default(uuid()) @db.Uuid @map("group_id")
  name          String               @unique
  memberships   StockGroupMembership[]
  rotationScores RotationScore[]

  @@map("stock_group")
  @@schema("production_layer")
}

model StockGroupMembership {
  stockId       String        @db.Uuid @map("stock_id")
  groupId       String        @db.Uuid @map("group_id")
  verifiedAt    DateTime?     @db.Timestamptz(6) @map("verified_at")
  source        String?

  stock         CanonicalStock @relation(fields: [stockId], references: [stockId], onDelete: Restrict)
  group         StockGroup     @relation(fields: [groupId], references: [groupId], onDelete: Restrict)

  @@id([stockId, groupId])
  @@map("stock_group_membership")
  @@schema("production_layer")
}

model Theme {
  themeId       String     @id @default(uuid()) @db.Uuid @map("theme_id")
  name          String     @unique
  subThemes     SubTheme[]

  @@map("theme")
  @@schema("production_layer")
}

model SubTheme {
  subThemeId    String      @id @default(uuid()) @db.Uuid @map("sub_theme_id")
  themeId       String      @db.Uuid @map("theme_id")
  name          String

  theme         Theme       @relation(fields: [themeId], references: [themeId], onDelete: Restrict)
  industries    Industry[]

  @@unique([themeId, name])
  @@map("sub_theme")
  @@schema("production_layer")
}

model Industry {
  industryId    String                   @id @default(uuid()) @db.Uuid @map("industry_id")
  subThemeId    String                   @db.Uuid @map("sub_theme_id")
  name          String

  subTheme      SubTheme                 @relation(fields: [subThemeId], references: [subThemeId], onDelete: Restrict)
  memberships   StockThemeMembership[]

  @@unique([subThemeId, name])
  @@map("industry")
  @@schema("production_layer")
}

model StockThemeMembership {
  stockId       String       @db.Uuid @map("stock_id")
  industryId    String       @db.Uuid @map("industry_id")
  verifiedAt    DateTime?    @db.Timestamptz(6) @map("verified_at")
  source        String?

  stock         CanonicalStock @relation(fields: [stockId], references: [stockId], onDelete: Restrict)
  industry      Industry       @relation(fields: [industryId], references: [industryId], onDelete: Restrict)

  @@id([stockId, industryId])
  @@map("stock_theme_membership")
  @@schema("production_layer")
}

model ValueChainStage {
  stageId       String            @id @default(uuid()) @db.Uuid @map("stage_id")
  stockId       String            @db.Uuid @map("stock_id")
  stageName     String            @map("stage_name")
  detail        Json?
  source        String?
  updatedAt     DateTime          @default(now()) @db.Timestamptz(6) @map("updated_at")

  stock         CanonicalStock    @relation(fields: [stockId], references: [stockId], onDelete: Restrict)
  evidence      ValueChainEvidence[]

  @@index([stockId, stageName])
  @@map("value_chain_stage")
  @@schema("production_layer")
}

model ValueChainEvidence {
  evidenceId    String          @id @default(uuid()) @db.Uuid @map("evidence_id")
  stageId       String          @db.Uuid @map("stage_id")
  evidenceType  String          @map("evidence_type")
  sourceName    String          @map("source_name")
  sourceUrl     String?         @map("source_url")
  observedAt    DateTime?       @db.Timestamptz(6) @map("observed_at")
  claim         String
  verification  VerificationStatus @map("verification")
  createdAt     DateTime        @default(now()) @db.Timestamptz(6) @map("created_at")

  stage         ValueChainStage @relation(fields: [stageId], references: [stageId], onDelete: Restrict)

  @@index([stageId])
  @@map("value_chain_evidence")
  @@schema("production_layer")
}

model RotationScore {
  rotationId        String          @id @default(uuid()) @db.Uuid @map("rotation_id")
  level             String
  horizon           String
  stockGroupId      String?         @db.Uuid @map("stock_group_id")
  subSectorId       String?         @db.Uuid @map("sub_sector_id")
  sectorId          String?         @db.Uuid @map("sector_id")
  medianReturn      Decimal?        @db.Decimal @map("median_return")
  participation     Decimal?        @db.Decimal
  ewCappedReturn    Decimal?        @db.Decimal @map("ew_capped_return")
  iqrConsistency    Decimal?        @db.Decimal @map("iqr_consistency")
  confidence        Decimal         @db.Decimal
  state             String?
  finalScore        Decimal?        @db.Decimal @map("final_score")
  calculatedAt      DateTime        @default(now()) @db.Timestamptz(6) @map("calculated_at")
  formulaVersionId  String          @db.Uuid @map("formula_version_id")
  configurationSnapshot Json         @map("configuration_snapshot")

  stockGroup        StockGroup?     @relation(fields: [stockGroupId], references: [groupId], onDelete: Restrict)
  subSector         SubSector?      @relation(fields: [subSectorId], references: [subSectorId], onDelete: Restrict)
  sector            Sector?         @relation(fields: [sectorId], references: [sectorId], onDelete: Restrict)
  formulaVersion    FormulaVersion  @relation(fields: [formulaVersionId], references: [formulaVersionId], onDelete: Restrict)

  @@index([level, horizon, calculatedAt])
  @@index([stockGroupId, horizon, calculatedAt])
  @@index([subSectorId, horizon, calculatedAt])
  @@index([sectorId, horizon, calculatedAt])
  @@map("rotation_score")
  @@schema("production_layer")
}

model StockScore {
  scoreId             String         @id @default(uuid()) @db.Uuid @map("score_id")
  stockId             String         @db.Uuid @map("stock_id")
  momentum            Decimal?       @db.Decimal
  earningsMomentum    Decimal?       @db.Decimal @map("earnings_momentum")
  businessQuality     Decimal?       @db.Decimal @map("business_quality")
  relativeStrength    Decimal?       @db.Decimal @map("relative_strength")
  valuation           Decimal?       @db.Decimal
  trendQuality        Decimal?       @db.Decimal @map("trend_quality")
  volumeConfirmation  Decimal?       @db.Decimal @map("volume_confirmation")
  growthVisibility    Decimal?       @db.Decimal @map("growth_visibility")
  baseScore           Decimal?       @db.Decimal @map("base_score")
  riskPenalty         Decimal?       @db.Decimal @map("risk_penalty")
  catalyst            Int?           @map("catalyst")
  finalScore          Decimal?       @db.Decimal @map("final_score")
  confidence          Decimal        @db.Decimal
  calculatedAt        DateTime       @default(now()) @db.Timestamptz(6) @map("calculated_at")
  formulaVersionId    String         @db.Uuid @map("formula_version_id")
  configurationSnapshot Json         @map("configuration_snapshot")
  comparisonSnapshot  Json?         @map("comparison_snapshot")

  stock               CanonicalStock @relation(fields: [stockId], references: [stockId], onDelete: Restrict)
  formulaVersion      FormulaVersion @relation(fields: [formulaVersionId], references: [formulaVersionId], onDelete: Restrict)

  @@index([stockId, calculatedAt])
  @@index([formulaVersionId, calculatedAt])
  @@map("stock_score")
  @@schema("production_layer")
}

model ShariahStatus {
  stockId     String          @id @db.Uuid @map("stock_id")
  status      String
  source      String?
  updatedAt   DateTime        @default(now()) @db.Timestamptz(6) @map("updated_at")

  stock       CanonicalStock  @relation(fields: [stockId], references: [stockId], onDelete: Restrict)

  @@map("shariah_status")
  @@schema("production_layer")
}

// ============================================================
// STAGING ENRICHMENT — LIVE 001-007 OBJECT
// ============================================================

model Master4187Staging {
  stagingRowId  BigInt    @id @default(autoincrement()) @db.BigInt @map("staging_row_id")
  batchId       String?   @db.Uuid @map("batch_id")
  name          String
  symbol        String
  exchange      String
  sector        String?
  subSector     String?   @map("sub_sector")
  identityStatus String   @default("PENDING") @map("identity_status")
  createdAt     DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")

  @@index([exchange, symbol])
  @@map("master_4187_staging")
  @@schema("staging_enrichment")
}

// NOTE:
// governance_layer.v_* views and governance_layer.resolve_identity_conflict()
// are intentionally SQL migration-only because the deployed DB owns these
// executable database artifacts and their security posture.
```

## 3. Forward migration 008 — C5 status dimensions reconciliation

**Purpose:** add the four independent C5 dimensions to `production_layer.raw_stock_observation` while preserving every live field.

**Important:** no status default is invented. If rows already exist when this migration runs, it stops rather than silently guessing status values.

```sql
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'freshness_status'
  ) THEN
    CREATE TYPE production_layer.freshness_status AS ENUM (
      'LIVE', 'DELAYED', 'STALE', 'UNAVAILABLE'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'verification_status'
  ) THEN
    CREATE TYPE production_layer.verification_status AS ENUM (
      'VERIFIED', 'UNKNOWN'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'interpretation_status'
  ) THEN
    CREATE TYPE production_layer.interpretation_status AS ENUM (
      'NOT_INTERPRETABLE', 'INTERPRETABLE'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'workflow_status'
  ) THEN
    CREATE TYPE production_layer.workflow_status AS ENUM (
      'SOURCE_REQUIRED', 'PENDING', 'MISSING'
    );
  END IF;
END $$;

ALTER TABLE production_layer.raw_stock_observation
  ADD COLUMN IF NOT EXISTS freshness_status production_layer.freshness_status,
  ADD COLUMN IF NOT EXISTS verification_status production_layer.verification_status,
  ADD COLUMN IF NOT EXISTS interpretation_status production_layer.interpretation_status,
  ADD COLUMN IF NOT EXISTS workflow_status production_layer.workflow_status,
  ADD COLUMN IF NOT EXISTS retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS configuration_snapshot jsonb;

DO $$
DECLARE
  v_rows bigint;
  v_null_status_rows bigint;
BEGIN
  SELECT count(*) INTO v_rows
  FROM production_layer.raw_stock_observation;

  SELECT count(*) INTO v_null_status_rows
  FROM production_layer.raw_stock_observation
  WHERE freshness_status IS NULL
     OR verification_status IS NULL
     OR interpretation_status IS NULL
     OR workflow_status IS NULL;

  IF v_rows <> 0 OR v_null_status_rows <> 0 THEN
    RAISE EXCEPTION
      'Migration 008 requires an explicit deterministic C5 backfill before NOT NULL enforcement; existing rows=%, rows missing C5=%',
      v_rows, v_null_status_rows;
  END IF;
END $$;

ALTER TABLE production_layer.raw_stock_observation
  ALTER COLUMN freshness_status SET NOT NULL,
  ALTER COLUMN verification_status SET NOT NULL,
  ALTER COLUMN interpretation_status SET NOT NULL,
  ALTER COLUMN workflow_status SET NOT NULL;

COMMIT;
```

**Rollback:** forward-only; no destructive rollback. If the gate fails, no schema state is committed. Any later reversal must be a new compensating migration after review.

**Risk:** Medium. Existing row values are protected from invented backfill; migration intentionally stops if data exists.

**RLS:** Existing `raw_stock_observation` RLS remains intact.

**Constraints:** four C5 columns become NOT NULL only after deterministic evidence exists.

---

# 4. Forward migration 009 — C9 role reconciliation

**Purpose:** create the authoritative application role type required by ODR-2026-002 C9.

```sql
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'identity_role'
  ) THEN
    CREATE TYPE public.identity_role AS ENUM ('USER', 'ADMIN', 'OWNER');
  END IF;
END $$;

COMMIT;
```

**Rollback:** forward-only; enum values are governance-controlled and must not be casually removed. Any future role change requires an Owner-approved governance change and a new migration.

**Risk:** Low.

**RLS:** No table yet; no client surface.

**Constraints:** establishes exact C9 role vocabulary for `app_user`.

---

# 5. Forward migration 010 — OIDC/auth persistence + application control plane

**Purpose:** create the persistent application identity/session/entitlement/MFA/control tables required by ODR-2026-001 and Blueprint security governance. No password column is created.

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.app_user (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oidc_issuer text NOT NULL,
  oidc_subject text NOT NULL,
  email text NOT NULL,
  email_verified boolean NOT NULL,
  role public.identity_role NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  disabled_at timestamptz,
  UNIQUE (email),
  UNIQUE (oidc_issuer, oidc_subject)
);

CREATE INDEX IF NOT EXISTS app_user_role_idx
  ON public.app_user(role);

CREATE TABLE IF NOT EXISTS public.session (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_user(user_id),
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS session_user_expiry_idx
  ON public.session(user_id, expires_at);

CREATE INDEX IF NOT EXISTS session_user_revoked_idx
  ON public.session(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS public.entitlement (
  entitlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_user(user_id),
  tier text NOT NULL,
  source text NOT NULL,
  status text NOT NULL,
  payment_ref text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS entitlement_user_status_idx
  ON public.entitlement(user_id, status);

CREATE TABLE IF NOT EXISTS public.feature_policy (
  feature_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL,
  updated_by_user_id uuid REFERENCES public.app_user(user_id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_policy_updated_by_idx
  ON public.feature_policy(updated_by_user_id);

CREATE TABLE IF NOT EXISTS public.formula_version (
  formula_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_key text NOT NULL,
  version text NOT NULL,
  formula_hash text NOT NULL,
  configuration_snapshot jsonb,
  owner_approved_by_user_id uuid REFERENCES public.app_user(user_id),
  owner_approved_at timestamptz,
  locked_at timestamptz,
  supersedes_version_id uuid REFERENCES public.formula_version(formula_version_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formula_key, version),
  CHECK (
    locked_at IS NULL
    OR (
      owner_approved_by_user_id IS NOT NULL
      AND owner_approved_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS formula_version_key_locked_idx
  ON public.formula_version(formula_key, locked_at);

CREATE TABLE IF NOT EXISTS public.owner_totp_secret (
  user_id uuid PRIMARY KEY REFERENCES public.app_user(user_id),
  secret_ciphertext bytea NOT NULL,
  kms_key_ref text NOT NULL,
  key_version text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  disabled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.owner_mfa_challenge (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_user(user_id),
  challenge_hash bytea NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS owner_mfa_challenge_user_expiry_idx
  ON public.owner_mfa_challenge(user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.app_audit_log (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid REFERENCES public.app_user(user_id),
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_audit_log_actor_created_idx
  ON public.app_audit_log(actor_id, created_at);

CREATE INDEX IF NOT EXISTS app_audit_log_action_created_idx
  ON public.app_audit_log(action, created_at);

COMMIT;
```

**Rollback:** forward-only. These are authority/security tables. Never drop them as a rollback tactic; repair with a compensating migration or restore from backup after a formal incident decision.

**Risk:** High because this establishes identity, sessions, Owner MFA secrets and entitlement control-plane storage.

**RLS:** intentionally added in migration 012, not here, so the table-creation migration remains separate from authorization policy rollout.

**Constraints:** no `password_hash` field; OIDC identity is unique on `(oidc_issuer, oidc_subject)`.

---

# 6. Forward migration 011 — Domain tables

**Purpose:** add the normalized Market Classification, Master Stock Group registry, Theme Intelligence, Value Chain, Rotation output, Stock Score output, and Shariah structures without changing 001-007.

```sql
BEGIN;

-- Market Classification
CREATE TABLE IF NOT EXISTS production_layer.sector (
  sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.sub_sector (
  sub_sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES production_layer.sector(sector_id),
  name text NOT NULL,
  UNIQUE (sector_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.stock_classification (
  stock_id uuid PRIMARY KEY REFERENCES production_layer.canonical_stock(stock_id),
  sub_sector_id uuid NOT NULL REFERENCES production_layer.sub_sector(sub_sector_id),
  verified_at timestamptz,
  source text
);

-- Master Stock Group registry — separate from Market Classification hierarchy.
CREATE TABLE IF NOT EXISTS production_layer.stock_group (
  group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.stock_group_membership (
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  group_id uuid NOT NULL REFERENCES production_layer.stock_group(group_id),
  verified_at timestamptz,
  source text,
  PRIMARY KEY (stock_id, group_id)
);

-- Theme Intelligence: THEME -> SUB-THEME -> INDUSTRY -> STOCK.
CREATE TABLE IF NOT EXISTS production_layer.theme (
  theme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.sub_theme (
  sub_theme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES production_layer.theme(theme_id),
  name text NOT NULL,
  UNIQUE (theme_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.industry (
  industry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_theme_id uuid NOT NULL REFERENCES production_layer.sub_theme(sub_theme_id),
  name text NOT NULL,
  UNIQUE (sub_theme_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.stock_theme_membership (
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  industry_id uuid NOT NULL REFERENCES production_layer.industry(industry_id),
  verified_at timestamptz,
  source text,
  PRIMARY KEY (stock_id, industry_id)
);

-- Business / Value Chain
CREATE TABLE IF NOT EXISTS production_layer.value_chain_stage (
  stage_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  stage_name text NOT NULL CHECK (stage_name IN (
    'RAW_MATERIAL_INPUT',
    'MINING_EXTRACTION',
    'SOURCING_PROCUREMENT',
    'PROCESSING',
    'MANUFACTURING',
    'CAPACITY_UTILISATION_CAPEX',
    'PRODUCTS_BYPRODUCTS',
    'CUSTOMERS_DISTRIBUTION',
    'DOWNSTREAM_INDUSTRIES',
    'FINAL_END_USE'
  )),
  detail jsonb,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_layer.value_chain_evidence (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES production_layer.value_chain_stage(stage_id),
  evidence_type text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  observed_at timestamptz,
  claim text NOT NULL,
  verification production_layer.verification_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS value_chain_stage_stock_idx
  ON production_layer.value_chain_stage(stock_id, stage_name);

CREATE INDEX IF NOT EXISTS value_chain_evidence_stage_idx
  ON production_layer.value_chain_evidence(stage_id);

-- Rotation outputs.
CREATE TABLE IF NOT EXISTS production_layer.rotation_score (
  rotation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  horizon text NOT NULL,
  stock_group_id uuid REFERENCES production_layer.stock_group(group_id),
  sub_sector_id uuid REFERENCES production_layer.sub_sector(sub_sector_id),
  sector_id uuid REFERENCES production_layer.sector(sector_id),
  median_return numeric,
  participation numeric,
  ew_capped_return numeric,
  iqr_consistency numeric,
  confidence numeric NOT NULL,
  state text,
  final_score numeric,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version_id uuid NOT NULL REFERENCES public.formula_version(formula_version_id),
  configuration_snapshot jsonb NOT NULL,
  CHECK (level IN ('STOCK_GROUP','SUB_SECTOR','SECTOR')),
  CHECK (horizon IN ('1D','1W','1M','3M')),
  CHECK (
    (level = 'STOCK_GROUP' AND stock_group_id IS NOT NULL AND sub_sector_id IS NULL AND sector_id IS NULL)
    OR
    (level = 'SUB_SECTOR' AND stock_group_id IS NULL AND sub_sector_id IS NOT NULL AND sector_id IS NULL)
    OR
    (level = 'SECTOR' AND stock_group_id IS NULL AND sub_sector_id IS NULL AND sector_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS rotation_score_level_horizon_time_idx
  ON production_layer.rotation_score(level, horizon, calculated_at);

-- Stock Score historical outputs — NOT unique by stock, because history is required.
CREATE TABLE IF NOT EXISTS production_layer.stock_score (
  score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  momentum numeric,
  earnings_momentum numeric,
  business_quality numeric,
  relative_strength numeric,
  valuation numeric,
  trend_quality numeric,
  volume_confirmation numeric,
  growth_visibility numeric,
  base_score numeric,
  risk_penalty numeric CHECK (risk_penalty BETWEEN -30 AND 0),
  catalyst integer CHECK (catalyst IN (0,4,8,12)),
  final_score numeric CHECK (final_score BETWEEN 0 AND 100 OR final_score IS NULL),
  confidence numeric NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version_id uuid NOT NULL REFERENCES public.formula_version(formula_version_id),
  configuration_snapshot jsonb NOT NULL,
  comparison_snapshot jsonb
);

CREATE INDEX IF NOT EXISTS stock_score_stock_time_idx
  ON production_layer.stock_score(stock_id, calculated_at);

CREATE INDEX IF NOT EXISTS stock_score_formula_time_idx
  ON production_layer.stock_score(formula_version_id, calculated_at);

-- Shariah display/status storage.
CREATE TABLE IF NOT EXISTS production_layer.shariah_status (
  stock_id uuid PRIMARY KEY REFERENCES production_layer.canonical_stock(stock_id),
  status text NOT NULL CHECK (status IN ('VERIFIED_SHARIAH','NON_SHARIAH','PENDING')),
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
```

**Rollback:** forward-only. No DROP statements. Any correction is a new compensating migration.

**Risk:** High. This introduces the core production-domain relations used by Rotation, Stock Score, Theme, Value Chain and Shariah.

**RLS:** added in 012.

**Constraints:** strong FK and CHECK constraints are intentional. `stock_score` remains historical; no `UNIQUE(stock_id)` is created.

---

# 7. Forward migration 012 — RLS + provenance + constraints

**Purpose:** establish the server-only security boundary for all new application/domain tables, enforce raw-data immutability, connect raw observations to canonical stock, and enforce formula governance.

```sql
BEGIN;

-- ------------------------------------------------------------
-- Server-only DB boundary: revoke direct client access.
-- ------------------------------------------------------------
REVOKE ALL ON TABLE
  public.app_user,
  public.session,
  public.entitlement,
  public.feature_policy,
  public.formula_version,
  public.owner_totp_secret,
  public.owner_mfa_challenge,
  public.app_audit_log
FROM anon, authenticated;

REVOKE ALL ON TABLE
  production_layer.sector,
  production_layer.sub_sector,
  production_layer.stock_classification,
  production_layer.stock_group,
  production_layer.stock_group_membership,
  production_layer.theme,
  production_layer.sub_theme,
  production_layer.industry,
  production_layer.stock_theme_membership,
  production_layer.value_chain_stage,
  production_layer.value_chain_evidence,
  production_layer.rotation_score,
  production_layer.stock_score,
  production_layer.shariah_status
FROM anon, authenticated;

ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_totp_secret ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_mfa_challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE production_layer.sector ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.sub_sector ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_group_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.sub_theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.industry ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_theme_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.value_chain_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.value_chain_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.rotation_score ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_score ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.shariah_status ENABLE ROW LEVEL SECURITY;

-- Explicit fail-closed policies for client roles.
CREATE POLICY app_user_deny_anon ON public.app_user FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY app_user_deny_auth ON public.app_user FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY session_deny_anon ON public.session FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY session_deny_auth ON public.session FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY entitlement_deny_anon ON public.entitlement FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY entitlement_deny_auth ON public.entitlement FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY feature_policy_deny_anon ON public.feature_policy FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY feature_policy_deny_auth ON public.feature_policy FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY formula_version_deny_anon ON public.formula_version FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY formula_version_deny_auth ON public.formula_version FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY owner_totp_secret_deny_anon ON public.owner_totp_secret FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY owner_totp_secret_deny_auth ON public.owner_totp_secret FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY owner_mfa_challenge_deny_anon ON public.owner_mfa_challenge FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY owner_mfa_challenge_deny_auth ON public.owner_mfa_challenge FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY app_audit_log_deny_anon ON public.app_audit_log FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY app_audit_log_deny_auth ON public.app_audit_log FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY sector_deny_anon ON production_layer.sector FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sector_deny_auth ON production_layer.sector FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY sub_sector_deny_anon ON production_layer.sub_sector FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sub_sector_deny_auth ON production_layer.sub_sector FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_classification_deny_anon ON production_layer.stock_classification FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_classification_deny_auth ON production_layer.stock_classification FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_group_deny_anon ON production_layer.stock_group FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_group_deny_auth ON production_layer.stock_group FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_group_membership_deny_anon ON production_layer.stock_group_membership FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_group_membership_deny_auth ON production_layer.stock_group_membership FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY theme_deny_anon ON production_layer.theme FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY theme_deny_auth ON production_layer.theme FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY sub_theme_deny_anon ON production_layer.sub_theme FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sub_theme_deny_auth ON production_layer.sub_theme FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY industry_deny_anon ON production_layer.industry FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY industry_deny_auth ON production_layer.industry FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_theme_membership_deny_anon ON production_layer.stock_theme_membership FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_theme_membership_deny_auth ON production_layer.stock_theme_membership FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY value_chain_stage_deny_anon ON production_layer.value_chain_stage FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY value_chain_stage_deny_auth ON production_layer.value_chain_stage FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY value_chain_evidence_deny_anon ON production_layer.value_chain_evidence FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY value_chain_evidence_deny_auth ON production_layer.value_chain_evidence FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY rotation_score_deny_anon ON production_layer.rotation_score FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY rotation_score_deny_auth ON production_layer.rotation_score FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_score_deny_anon ON production_layer.stock_score FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_score_deny_auth ON production_layer.stock_score FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY shariah_status_deny_anon ON production_layer.shariah_status FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY shariah_status_deny_auth ON production_layer.shariah_status FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ------------------------------------------------------------
-- Provenance and formula governance.
-- ------------------------------------------------------------
ALTER TABLE production_layer.raw_stock_observation
  ADD COLUMN IF NOT EXISTS formula_version_id uuid;

ALTER TABLE production_layer.raw_stock_observation
  ADD CONSTRAINT raw_stock_observation_formula_version_fkey
  FOREIGN KEY (formula_version_id)
  REFERENCES public.formula_version(formula_version_id)
  NOT VALID;

ALTER TABLE production_layer.raw_stock_observation
  VALIDATE CONSTRAINT raw_stock_observation_formula_version_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM production_layer.raw_stock_observation r
    LEFT JOIN production_layer.canonical_stock c ON c.stock_id = r.stock_id
    WHERE r.stock_id IS NULL OR c.stock_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Raw observation contains NULL or orphan stock_id; refusing to strengthen provenance constraint.';
  END IF;
END $$;

ALTER TABLE production_layer.raw_stock_observation
  ALTER COLUMN stock_id SET NOT NULL;

ALTER TABLE production_layer.raw_stock_observation
  ADD CONSTRAINT raw_stock_observation_derived_formula_check
  CHECK (
    data_nature <> 'DERIVED'
    OR (
      formula_version IS NOT NULL
      AND formula_version_id IS NOT NULL
      AND configuration_snapshot IS NOT NULL
    )
  );

-- Governance audit actor relationship to the application identity plane.
ALTER TABLE governance_layer.audit_log
  ADD CONSTRAINT governance_audit_actor_user_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES public.app_user(user_id)
  NOT VALID;

ALTER TABLE governance_layer.audit_log
  VALIDATE CONSTRAINT governance_audit_actor_user_fkey;

-- ------------------------------------------------------------
-- Append-only trigger shared by raw observations and audit logs.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Append-only table: % is not permitted on %.', TG_OP, TG_TABLE_NAME;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_append_only_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS raw_observation_immutable ON production_layer.raw_stock_observation;
CREATE TRIGGER raw_observation_immutable
  BEFORE UPDATE OR DELETE ON production_layer.raw_stock_observation
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

DROP TRIGGER IF EXISTS governance_audit_immutable ON governance_layer.audit_log;
CREATE TRIGGER governance_audit_immutable
  BEFORE UPDATE OR DELETE ON governance_layer.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

DROP TRIGGER IF EXISTS app_audit_immutable ON public.app_audit_log;
CREATE TRIGGER app_audit_immutable
  BEFORE UPDATE OR DELETE ON public.app_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

-- ------------------------------------------------------------
-- Locked formula versions cannot be edited in place.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_locked_formula_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Locked formula version % cannot be updated or deleted.', OLD.formula_version_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_locked_formula_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS formula_version_locked_guard ON public.formula_version;
CREATE TRIGGER formula_version_locked_guard
  BEFORE UPDATE OR DELETE ON public.formula_version
  FOR EACH ROW EXECUTE FUNCTION public.reject_locked_formula_mutation();

-- ------------------------------------------------------------
-- Owner-only control-plane invariants enforced server-side/DB-side.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_owner_totp_owner_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role public.identity_role;
BEGIN
  SELECT role INTO v_role
  FROM public.app_user
  WHERE user_id = NEW.user_id;

  IF v_role IS DISTINCT FROM 'OWNER'::public.identity_role THEN
    RAISE EXCEPTION 'TOTP secret may only belong to an OWNER.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_owner_totp_owner_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS owner_totp_owner_role_guard ON public.owner_totp_secret;
CREATE TRIGGER owner_totp_owner_role_guard
  BEFORE INSERT OR UPDATE ON public.owner_totp_secret
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_totp_owner_role();

DROP TRIGGER IF EXISTS owner_mfa_owner_role_guard ON public.owner_mfa_challenge;
CREATE TRIGGER owner_mfa_owner_role_guard
  BEFORE INSERT OR UPDATE ON public.owner_mfa_challenge
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_totp_owner_role();

COMMIT;
```

**Rollback:** forward-only. Security constraints are not rolled back destructively. If a policy or trigger is wrong, fix with a new compensating migration.

**Risk:** High. This is the main server-only authorization and provenance enforcement boundary.

**RLS:** all new public/domain tables are fail-closed to `anon` and `authenticated`; server-side access is expected through the trusted backend role.

**Constraint implications:** raw observations become required to point to canonical stock and derived observations become required to carry formula provenance/configuration.

---

# 8. Forward migration 013 — QC views/functions alignment

**Purpose:** preserve the existing 001-007 QC logic, add C5/formula provenance checks, and keep `resolve_identity_conflict()` as a SQL-owned governance function.

```sql
BEGIN;

CREATE OR REPLACE VIEW governance_layer.v_check_row_count
WITH (security_invoker = true)
AS
SELECT
  'ROW_COUNT'::text AS check_name,
  '4187'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 4187 THEN 'PASS' ELSE 'FAIL' END AS status
FROM staging_enrichment.master_4187_staging;

CREATE OR REPLACE VIEW governance_layer.v_check_open_identity_conflicts
WITH (security_invoker = true)
AS
SELECT
  'OPEN_IDENTITY_CONFLICTS'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM governance_layer.identity_conflict
WHERE status = 'OPEN';

CREATE OR REPLACE VIEW governance_layer.v_check_pending_resolution_requests
WITH (security_invoker = true)
AS
SELECT
  'PENDING_RESOLUTION_REQUESTS'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM governance_layer.identity_resolution_requests
WHERE state = 'AWAITING_OWNER';

CREATE OR REPLACE VIEW governance_layer.v_check_orphan_foreign_keys
WITH (security_invoker = true)
AS
SELECT
  'ORPHAN_FOREIGN_KEYS'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM production_layer.raw_stock_observation r
LEFT JOIN production_layer.canonical_stock c ON c.stock_id = r.stock_id
WHERE r.stock_id IS NOT NULL AND c.stock_id IS NULL;

CREATE OR REPLACE VIEW governance_layer.v_check_isin_format
WITH (security_invoker = true)
AS
SELECT
  'ISIN_FORMAT'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM governance_layer.identity_resolution_requests
WHERE proposed_isin IS NOT NULL
  AND proposed_isin !~ '^IN[A-Za-z0-9]{10}$';

CREATE OR REPLACE VIEW governance_layer.v_check_sector_coverage
WITH (security_invoker = true)
AS
WITH eligible_rows AS (
  SELECT staging_row_id, sector
  FROM staging_enrichment.master_4187_staging
  WHERE coalesce(identity_status, 'PENDING') NOT IN ('QUARANTINED','PENDING')
),
coverage AS (
  SELECT
    count(*)::bigint AS eligible_count,
    count(*) FILTER (WHERE sector IS NULL OR btrim(sector) = '')::bigint AS missing_sector_count
  FROM eligible_rows
)
SELECT
  'SECTOR_COVERAGE'::text AS check_name,
  '0'::text AS expected,
  missing_sector_count::text AS actual,
  CASE WHEN missing_sector_count = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM coverage;

CREATE OR REPLACE VIEW governance_layer.v_check_c5_status_completeness
WITH (security_invoker = true)
AS
SELECT
  'C5_STATUS_COMPLETENESS'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM production_layer.raw_stock_observation
WHERE freshness_status IS NULL
   OR verification_status IS NULL
   OR interpretation_status IS NULL
   OR workflow_status IS NULL;

CREATE OR REPLACE VIEW governance_layer.v_check_derived_formula_version
WITH (security_invoker = true)
AS
SELECT
  'DERIVED_FORMULA_PROVENANCE'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM production_layer.raw_stock_observation
WHERE data_nature = 'DERIVED'
  AND (
    formula_version IS NULL
    OR formula_version_id IS NULL
    OR configuration_snapshot IS NULL
  );

CREATE OR REPLACE VIEW governance_layer.v_import_readiness
WITH (security_invoker = true)
AS
WITH checks AS (
  SELECT check_name, expected, actual, status FROM governance_layer.v_check_row_count
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_open_identity_conflicts
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_pending_resolution_requests
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_orphan_foreign_keys
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_isin_format
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_sector_coverage
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_c5_status_completeness
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_derived_formula_version
)
SELECT
  check_name,
  expected,
  actual,
  status,
  NOT EXISTS (
    SELECT 1 FROM checks failed WHERE failed.status = 'FAIL'
  ) AS import_ready
FROM checks
ORDER BY check_name;

CREATE OR REPLACE VIEW governance_layer.v_pending_resolutions
WITH (security_invoker = true)
AS
SELECT
  id,
  symbol,
  conflict_type,
  evidence_url,
  proposed_canonical_identity,
  proposed_isin,
  impact_on_4187_rows,
  state,
  owner_decision,
  owner_decided_at,
  owner_note,
  created_at
FROM governance_layer.identity_resolution_requests
WHERE state = 'AWAITING_OWNER'
ORDER BY symbol;

CREATE OR REPLACE VIEW governance_layer.v_resolution_status
WITH (security_invoker = true)
AS
SELECT
  irr.symbol,
  irr.state AS resolution_state,
  ic.status AS conflict_state,
  COALESCE(irr.owner_note, ic.resolution_note) AS resolution_note,
  ic.resolved_at
FROM governance_layer.identity_resolution_requests AS irr
JOIN governance_layer.identity_conflict AS ic
  ON ic.symbol = irr.symbol;

CREATE OR REPLACE FUNCTION governance_layer.resolve_identity_conflict(
  p_symbol text,
  p_resolution_note text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, governance_layer
AS $$
DECLARE
  v_now timestamptz := now();
  v_resolution_state text;
  v_conflict_state text;
BEGIN
  IF p_symbol IS NULL OR btrim(p_symbol) = '' THEN
    RAISE EXCEPTION 'p_symbol must not be null or empty';
  END IF;

  IF p_resolution_note IS NULL OR btrim(p_resolution_note) = '' THEN
    RAISE EXCEPTION 'p_resolution_note must not be null or empty';
  END IF;

  SELECT state INTO v_resolution_state
  FROM governance_layer.identity_resolution_requests
  WHERE symbol = p_symbol
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No identity_resolution_requests row exists for symbol %', p_symbol;
  END IF;

  IF v_resolution_state = 'APPROVED' THEN
    RAISE EXCEPTION 'Identity resolution for symbol % is already APPROVED', p_symbol;
  ELSIF v_resolution_state <> 'AWAITING_OWNER' THEN
    RAISE EXCEPTION
      'Identity resolution for symbol % is not AWAITING_OWNER (state=%)',
      p_symbol, v_resolution_state;
  END IF;

  SELECT status INTO v_conflict_state
  FROM governance_layer.identity_conflict
  WHERE symbol = p_symbol
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No identity_conflict row exists for symbol %', p_symbol;
  END IF;

  IF v_conflict_state = 'RESOLVED' THEN
    RAISE EXCEPTION 'Identity conflict for symbol % is already RESOLVED', p_symbol;
  ELSIF v_conflict_state <> 'OPEN' THEN
    RAISE EXCEPTION
      'Identity conflict for symbol % is not OPEN (status=%)',
      p_symbol, v_conflict_state;
  END IF;

  UPDATE governance_layer.identity_resolution_requests
  SET state = 'APPROVED',
      owner_decision = 'APPROVED',
      owner_decided_at = v_now,
      owner_note = p_resolution_note
  WHERE symbol = p_symbol
    AND state = 'AWAITING_OWNER';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolution request for symbol % was not updated', p_symbol;
  END IF;

  UPDATE governance_layer.identity_conflict
  SET status = 'RESOLVED',
      resolution_note = p_resolution_note,
      resolved_at = v_now
  WHERE symbol = p_symbol
    AND status = 'OPEN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Identity conflict for symbol % was not updated', p_symbol;
  END IF;

  RETURN true;
END;
$$;

ALTER FUNCTION governance_layer.resolve_identity_conflict(text, text)
  OWNER TO service_role;

REVOKE ALL ON FUNCTION governance_layer.resolve_identity_conflict(text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION governance_layer.resolve_identity_conflict(text, text)
  TO service_role;

REVOKE ALL ON governance_layer.v_check_row_count FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_open_identity_conflicts FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_pending_resolution_requests FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_orphan_foreign_keys FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_isin_format FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_sector_coverage FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_c5_status_completeness FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_derived_formula_version FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_import_readiness FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_pending_resolutions FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_resolution_status FROM anon, authenticated;

COMMIT;
```

**Rollback:** forward-only. Views/functions can be replaced by later compensating definitions; no destructive rollback.

**Risk:** Medium. QC is read/decision-support logic; function security is high-sensitivity.

**RLS:** views are security-invoker and direct client access is revoked.

**Constraint implications:** import readiness now includes the C5 and derived-formula provenance gates.

---

# 9. Auth model — exact design contract

## 9.1 `public.app_user`

| Column | Type | Rule |
|---|---|---|
| `user_id` | UUID | PK |
| `oidc_issuer` | TEXT | Required |
| `oidc_subject` | TEXT | Required |
| `email` | TEXT | Unique |
| `email_verified` | BOOLEAN | Required |
| `role` | `identity_role` | USER default |
| `created_at` | TIMESTAMPTZ | Required |
| `updated_at` | TIMESTAMPTZ | Required |
| `last_login_at` | TIMESTAMPTZ | Optional |
| `disabled_at` | TIMESTAMPTZ | Optional |

**No password column.**

RLS: deny anon/authenticated. Backend-only.

Index: `(oidc_issuer, oidc_subject)` unique; role index.

Relationship: session, entitlements, MFA and audit records reference `app_user`.

## 9.2 `public.session`

Stores only the session token hash, never the raw session token.

RLS: deny anon/authenticated.

Indexes: user/expiry, user/revocation, unique token hash.

Relationship: `session.user_id -> app_user.user_id`.

## 9.3 `public.owner_totp_secret`

Encrypted ciphertext only.

Required security metadata:

- `kms_key_ref`
- optional `key_version`
- `confirmed_at`

RLS: deny anon/authenticated.

DB trigger: row may only belong to an `OWNER` role.

The actual KMS provider is **NOT_DEFINED** by the Blueprint; the provider must be selected before implementation. Plaintext secret storage is prohibited.

## 9.4 `public.owner_mfa_challenge`

Short-lived challenge state.

Stores hash of challenge material, expiry, consumption state, attempt count.

RLS: deny anon/authenticated.

DB trigger: only Owner identities.

## 9.5 `public.entitlement`

Represents the result of plan/trial/payment/Owner-grant processing.

The client cannot set entitlement tier, status or payment flags.

RLS: deny anon/authenticated.

Relationship: `entitlement.user_id -> app_user.user_id`.

Exact production payment provider remains **NOT_DEFINED** until separately selected, consistent with Blueprint §22.

## 9.6 `public.feature_policy`

Owner-controlled feature switches.

RLS: deny anon/authenticated.

Updates happen only through the server authorization layer and are audited.

## 9.7 `public.formula_version`

Stores:

- formula key
- version
- formula hash
- configuration snapshot
- Owner approval
- lock timestamp
- lineage to superseded version

Locked rows cannot be modified/deleted by DB trigger.

This directly supports Blueprint §5.7 and §33 reconstructibility.

## 9.8 `public.app_audit_log`

Application/security events distinct from data-governance audit history in `governance_layer.audit_log`.

Append-only.

---

# 10. Relationship to existing governance objects

| Existing object | Target relationship |
|---|---|
| `governance_layer.audit_log` | Optional `actor_user_id -> public.app_user.user_id`; forward FK in 012 |
| `master_import_batch` | remains source/governance batch record; staging batch_id remains application-owned |
| `identity_conflict` | remains conflict registry; resolution function remains SQL authority |
| `identity_resolution_requests` | remains Owner decision workflow; app UI/API must use server authorization |
| `source_evidence` | remains evidence provenance for classification/conflict decisions |
| `provider_registry` | remains provider registry; app provider configuration must not bypass it |
| `source_health` | remains source-health evidence |
| `canonical_stock` | becomes target canonical company/security registry referenced by domain tables |
| `raw_stock_observation` | remains immutable input layer; C5 + formula/config provenance are added |
| `master_4187_staging` | remains research staging area; no blind canonical import |

---

# 11. Live DB ↔ target Prisma mapping

| Live DB object | Reconciled Prisma target | Alignment | Gap / action |
|---|---|---|---|
| `governance_layer.audit_log` | `GovernanceAuditLog` | PASS | Add forward actor FK to `public.app_user` |
| `governance_layer.classification_review` | `ClassificationReview` | PASS | Existing SQL CHECKs remain migration-owned |
| `governance_layer.identity_conflict` | `IdentityConflict` | PASS | Existing unique/FK/checks preserved |
| `governance_layer.identity_resolution_requests` | `IdentityResolutionRequest` | PASS | Complex state CHECK remains SQL-owned |
| `governance_layer.master_import_batch` | `MasterImportBatch` | PASS | Existing status CHECK remains SQL-owned |
| `governance_layer.provider_registry` | `ProviderRegistry` | PASS | Existing provider/status CHECK remains SQL-owned |
| `governance_layer.source_evidence` | `SourceEvidence` | PASS | Existing CHECK/FK remains SQL-owned |
| `governance_layer.source_health` | `SourceHealth` | PASS | Existing FK retained |
| `production_layer.canonical_stock` | `CanonicalStock` | PASS | Live identity_key preserved |
| `production_layer.raw_stock_observation` | `RawStockObservation` | PASS after 008/012 | C5, provenance, formula relation added |
| `staging_enrichment.master_4187_staging` | `Master4187Staging` | PASS | Research-only staging preserved |
| `public.app_user` | `AppUser` | NEW | Not yet live; 010 |
| `public.session` | `Session` | NEW | Not yet live; 010 |
| `public.entitlement` | `Entitlement` | NEW | Not yet live; 010 |
| `public.feature_policy` | `FeaturePolicy` | NEW | Not yet live; 010 |
| `public.formula_version` | `FormulaVersion` | NEW | Not yet live; 010 |
| `public.owner_totp_secret` | `OwnerTotpSecret` | NEW | Not yet live; 010 |
| `public.owner_mfa_challenge` | `OwnerMfaChallenge` | NEW | Not yet live; 010 |
| `public.app_audit_log` | `AppAuditLog` | NEW | Not yet live; 010 |
| `production_layer.stock_group` | `StockGroup` | NEW | Not yet live; 011 |
| `production_layer.theme` | `Theme` | NEW | Not yet live; 011 |
| `production_layer.value_chain_stage` | `ValueChainStage` | NEW | Not yet live; 011 |
| `production_layer.rotation_score` | `RotationScore` | NEW | Not yet live; 011 |
| `production_layer.stock_score` | `StockScore` | NEW | Not yet live; 011 |
| `production_layer.shariah_status` | `ShariahStatus` | NEW | Not yet live; 011 |

---

# 12. Migration risk assessment

| Migration | Main risk | Risk | Gate before implementation |
|---|---|---|---|
| 008 C5 | Existing raw rows could lack deterministic status mapping | Medium | Confirm row-count remains 0 or approve deterministic backfill mapping |
| 009 C9 | Role type is security-sensitive | Low | Owner governance approval already recorded; no role escalation path |
| 010 Auth control plane | Identity/session/MFA/entitlement data is security-critical | High | Auth design audit + security tests |
| 011 Domain tables | Core product relations and score outputs | High | Formula/data-model audit before creating score tables |
| 012 RLS/provenance | Incorrect policy could block server or permit client access | High | SQL review + live negative/positive security tests |
| 013 QC/functions | Import gates/functions affect canonical eligibility | Medium-High | Golden QC cases + function security test |

---

# 13. Blueprint alignment report

| Blueprint section | Proposed design | Status | Evidence / comment |
|---|---|---|---|
| §4 Three independent layers | Market Classification, Theme Intelligence, Value Chain are separate relations/tables | PASS | `MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md` §4, lines 129-181 |
| §11 Stock 360° 21 sections | Schema provides supporting entities for Classification, Rotation, Score, Theme, Value Chain, Peers-ready classification, Market Data inputs, Shariah, provenance | PASS | Blueprint §11, lines 589-735 |
| §16 Google OIDC | `AppUser` is OIDC identity only; no password field | PASS | Blueprint §16, lines 829-884 + ODR-2026-001 |
| §23 roles | `IdentityRole = USER/ADMIN/OWNER`; server-controlled | PASS | Blueprint §23, lines 1125-1190 |
| §25 C5 status dimensions | Four distinct enums on raw observations | PASS | Blueprint §25, lines 1254-1293 |
| §26 data pipeline | staging/governance/canonical/raw provenance layers are preserved; forward additions enforce provenance | PASS | Blueprint §26, lines 1297-1350 |
| §33 reconstructibility | Formula version, formula hash, config snapshots and calculation outputs are stored | PASS | Blueprint §33, lines 1618-1629 |
| Rotation v1.2 | Rotation output links to formula version and config snapshot; no dependence on Stock Score | PASS | Blueprint §5, lines 203-288 |
| Stock Score SS-1.0-R3 | Historical output model, formula version and config snapshot | PASS | Blueprint §6, lines 296-385 |
| Shariah independence | Separate `shariah_status`; no score FK into Shariah | PASS | Blueprint §4 + §14 |
| Owner/admin authority | Client DB access denied; feature/formula control server-only | PASS | Blueprint §23-24 |
| Payment provider | Generic `payment_ref`; exact provider not embedded | PASS | Blueprint §22 says provider is NOT_DEFINED |
| KMS provider | `kms_key_ref`/`key_version`; provider not chosen | PASS / NOT_DEFINED | Blueprint does not select a vendor |
| Theme Score formula | No formula invented; no Theme Score calculation table added | PASS | Formula remains separately governed; exact formula not invented |

---

# 14. Misalignment / unresolved items

## BLOCKED

1. **Prisma toolchain validation is not yet available** in the current execution environment. The design is not a `prisma validate` PASS.
2. **Live migration deployment has not been run** and must not be run until this design passes the Owner approval gate.
3. **The exact KMS provider is not selected.** `owner_totp_secret` can be structurally designed, but the encryption service configuration is NOT_DEFINED.

## NOT_DEFINED

1. Exact payment provider.
2. Google-account-loss recovery procedure.
3. Additional OIDC providers.
4. Exact application session TTL policy.
5. Exact entitlement tier vocabulary.

## OWNER_DECISION_REQUIRED

No new business-rule conflict was introduced by this schema design. Any future change to the locked formula/configuration contract must follow ODR and Owner approval.

---

# 15. Recommended implementation sequence after Owner approval

```text
DESIGN  ← CURRENT GATE
   ↓
OWNER APPROVAL
   ↓
Create Prisma multi-schema contract
   ↓
Generate/record migration 008
   ↓
Apply 008 to staging/clone first
   ↓
C5 runtime verification
   ↓
009 role enum
   ↓
010 OIDC/session/MFA/entitlement control plane
   ↓
Auth negative tests
   ↓
011 domain tables
   ↓
012 RLS/provenance/immutability constraints
   ↓
Live RLS + provenance tests
   ↓
013 QC view/function regression
   ↓
Full regression suite
   ↓
Prisma migrate deploy against approved target
   ↓
Phase B gate review
```

No production deployment is permitted until the global gates in Blueprint §32 pass and explicit Owner approval is recorded.

---

# 16. Current design-gate status

| Item | Status | Evidence |
|---|---|---|
| Live DB architecture understood | PASS | Supabase read-only inspection |
| 001-007 preserved | PASS | No modifications planned |
| Reconciled Prisma architecture designed | PASS | Multi-schema target above |
| C5 reconciled | PASS | Four separate status fields; no invented default |
| C9 reconciled | PASS | `IdentityRole` enum |
| OIDC auth persistence designed | PASS | No password field; OIDC subject/issuer model |
| Owner TOTP persistence designed | PASS | KMS-reference ciphertext + Owner-only trigger |
| Entitlement/feature control designed | PASS | Server-only RLS |
| Formula governance designed | PASS | hash + config snapshot + lock trigger |
| Domain tables designed | PASS | classification/theme/value-chain/rotation/score/shariah |
| QC alignment designed | PASS | existing + C5/provenance checks |
| Prisma CLI validation | UNKNOWN | Toolchain not installed in current environment |
| Migration execution | UNKNOWN | Explicitly not run |
| Live runtime after 008+ | UNKNOWN | Implementation not started |
| Implementation gate | BLOCKED | Owner approval required before implementation |

**Design conclusion:** The reconciled target should align the repository to the existing live MarketNiora database architecture rather than replacing the live architecture with the old `public.*` draft schema. Existing migrations 001-007 remain the immutable baseline; 008+ is forward-only.
