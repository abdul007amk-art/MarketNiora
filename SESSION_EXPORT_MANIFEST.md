# MarketNiora Session Export

Purpose: fallback ZIP because the connected GitHub account exposed no accessible repositories, so the GitHub connector could not push to `[your-username]/marketniora`.

## Included requested content
- docs/odr/ODR-2026-001.md
- docs/odr/ODR-2026-002.md
- docs/MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md
- docs/archive/MarketNiora_Master_Guide_v1_ARCHIVED.md
- database/schema.sql
- database/prisma/schema.prisma
- database/migrations/008-013 SQL files
- backend/src/**
- tests/**
- README.md
- .gitignore

## Additional session artifacts
- database/migrations/007a_service_role_acl_design.sql
- docs/validation/**

## Important state note
The Prisma schema included here is the latest validation schema from this session and explicitly models public.app_audit_log.actor_type as String/text, matching the clone database. It is a validation artifact, not proof that the repository's DB-backed runtime integration is complete.

The backend/src code is exported as it existed in the reconciled session repository. No locked formula files were modified during packaging.

## Production safety
No production writes are part of this export.
