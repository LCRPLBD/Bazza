# NightZoom — Bazza's challenge
NightZoom-inspired tracker with 102 entries, 3 initial wins, searchable results and class filters. This is an unofficial fan tracker.

## Deploy on Railway
1. Create a Railway service from this GitHub repository.
2. Add a persistent Volume mounted at `/data`. Set `DATA_DIR=/data`.
3. Add the secret variable `EDITOR_PASSWORD` with your chosen password. The username is `Bazza` (case-sensitive). No password is included in this public repository.
4. Deploy and generate a Railway domain. Set `APP_ORIGIN=https://YOUR-DOMAIN` (no trailing slash) and redeploy.
5. Use one replica. Open the generated URL; click Driver login to edit results.

The Dockerfile configures production mode and Railway supplies PORT. Health check: `/health`. Volumes persist wins across deployments. Without a volume, saved progress can be lost on redeploy. Back up /data/wins.json using Railway volume backups.

## Permissions
Visitors can view results. Bazza can only change the boolean won/not-won value for existing entries. Names and classes are immutable via the API. The server enforces login on every write; client-side controls are not the security boundary. Password verification uses scrypt; sessions use random HttpOnly, SameSite=Strict, Secure production cookies. Login attempts are limited. Sessions expire after 8 hours and clear on server restart. Use a stronger password for an internet-facing service: a four-digit password has only 10,000 possibilities.

## Local development
Set EDITOR_PASSWORD, then `npm start`. Visit http://localhost:3000.
`npm test` checks initial data, rejected anonymous edits, login, input restrictions, logout, and persisted results after restart.

Duplicate r8 and Evo/evo entries are intentionally distinct; IDs follow the supplied list. FALSE means not won, not necessarily a recorded loss. All 101 S1 entries and the one Drift entry are retained.
