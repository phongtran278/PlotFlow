# Offline backup verification and restore rehearsal

Scope: local read-only inspection of a downloaded state.json and synthetic restore regression. No new Worker endpoint, no Azure credentials, network access or write. Existing Azure deployment workflow remains unchanged; never dispatch it for testing.

Owner can run locally from repo root (Node 22+):
```sh
node services/state-api/tools/inspect-state-backup.mjs "/absolute/path/to/state.json" vinhomes-saigon-park
```
Optional third argument: trusted SHA-256 recorded at backup acquisition (not a hash of the same unverified copy). Only summary metadata is printed; no storage values. Do not upload production backups to a public repository, Actions artifact or chat. Keep a secure separate copy. If no independently recorded digest exists, computed SHA-256 is a baseline only, not proof of original integrity. Check version, project ID, entry count and current API payload compatibility. The inspector does not verify domain-specific storage content or source freshness.

CI runs synthetic local byte-exact copy rehearsal (exclusive create, no overwrite), corruption, project mismatch, API size limit and conditional write tests using an in-memory Azure adapter. This proves tested mechanics only. Real Azure restore is NOT verified. No production backup has been inspected by this PR.

Before any real migration: verify downloaded backup against trusted acquisition metadata (size, timestamp, ETag/version and checksum where available); confirm separate staging storage and scoped credentials; use synthetic data only for write rehearsal, verify read-back and ETag conflict; establish a separately approved recovery procedure for actual production data with a current pre-change snapshot and explicit owner approval. Do not copy real data into public staging. Do not restore production from this tool. Rollback of code: retain previous Draft branch #71. No production deploy/merge or data mutation.
