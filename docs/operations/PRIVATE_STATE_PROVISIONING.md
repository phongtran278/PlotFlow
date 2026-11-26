# TASK 01B — private staging storage provisioning
This script is intentionally manual and is not a GitHub Actions workflow. It cannot access production state or use existing production connection-string secrets.

## Azure Cloud Shell (Bash)
1. Use a **dedicated staging StorageV2 account** (not the existing production storage account). Creating an account may incur Azure costs. Select the intended subscription. Disable anonymous blob access, enforce HTTPS, disable static website, and set the account tag `plotflow-environment=staging` in the portal. Do not tag a production account.
2. Use an Entra identity with permission to update the account blob service settings and Storage Blob Data Contributor for the staging account. No account keys are needed.
3. Retrieve `scripts/azure/provision-private-staging.sh` from this branch, inspect it, then run:
```bash
export STAGING_RESOURCE_GROUP='your-staging-resource-group'
export STAGING_STORAGE_ACCOUNT='your-dedicated-staging-account'
export CONFIRM_STAGING_ONLY=YES
bash scripts/azure/provision-private-staging.sh
```
The script enables account-level versioning and 14-day blob/container soft delete (only after checking the dedicated staging account), creates a private container, seeds an exact synthetic state fixture without overwriting, verifies authenticated readback, and checks anonymous GET/list denial. It stops if a different blob already exists. Do not run against a production account. No secret is printed or generated, no production blob is read, no deployment occurs.
4. Share only the PASS lines or redacted errors. HTTP denial confirms the tested public path, not proof of all access paths. Actual restore, Cloudflare Access/ACL and conditional browser writes require separate testing.
5. After successful provisioning generate a short-lived blob-scoped HTTPS-only user delegation SAS with rw permissions (maximum seven days for user delegation). Use the full URL only in the stable staging Worker runtime secret AZURE_BLOB_URLS_JSON, never Preview, GitHub or chat. Do not connect production data.

## Limits
The account tag is an operator assertion, not independent proof of account ownership or environment. Script assumes Azure public cloud, existing staging account, supported CLI and permissions. No live Azure execution has been performed by this PR.
