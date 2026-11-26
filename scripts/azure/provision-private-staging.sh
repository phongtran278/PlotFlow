#!/usr/bin/env bash
# Run in Azure Cloud Shell (Bash), authenticated with Microsoft Entra ID.
# Only targets an existing, explicitly selected dedicated staging account.
set -euo pipefail
umask 077
command -v az >/dev/null
command -v curl >/dev/null
command -v python3 >/dev/null
: "${STAGING_RESOURCE_GROUP:?Set STAGING_RESOURCE_GROUP}"
: "${STAGING_STORAGE_ACCOUNT:?Set STAGING_STORAGE_ACCOUNT}"
: "${CONFIRM_STAGING_ONLY:?Set CONFIRM_STAGING_ONLY=YES}"
[[ "$CONFIRM_STAGING_ONLY" == YES ]]
[[ "$STAGING_STORAGE_ACCOUNT" =~ ^[a-z0-9]{3,24}$ ]]
account="$STAGING_STORAGE_ACCOUNT"
rg="$STAGING_RESOURCE_GROUP"
container=plotflow-state-private
blob=vinhomes-saigon-park/state.json
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
# Require explicit staging tag and no static website. Never use account keys.
az storage account show -g "$rg" -n "$account" -o json > "$tmp/account.json"
python3 - "$tmp/account.json" <<'PY'
import json,sys
a=json.load(open(sys.argv[1]))
assert (a.get('tags') or {}).get('plotflow-environment') == 'staging', 'Missing explicit staging account tag'
assert a.get('allowBlobPublicAccess') is False, 'Account must disallow public blob access'
assert a.get('enableHttpsTrafficOnly') is True, 'HTTPS-only required'
assert not a.get('isHnsEnabled'), 'Blob versioning requires non-HNS account'
assert a.get('kind') == 'StorageV2', 'Use a dedicated StorageV2 account'
PY
website="$(az storage blob service-properties show --account-name "$account" --auth-mode login --query staticWebsite.enabled -o tsv)"
[[ "$website" == false ]] || { echo 'Static website enabled or status unknown; stopping.' >&2; exit 1; }
# Account-level backup settings: safe only on the dedicated staging account.
az storage account blob-service-properties update -g "$rg" -n "$account" --enable-versioning true --enable-delete-retention true --delete-retention-days 14 --enable-container-delete-retention true --container-delete-retention-days 14 --only-show-errors -o none
az storage container create --account-name "$account" --name "$container" --public-access off --auth-mode login --only-show-errors -o none
az storage container show --account-name "$account" --name "$container" --auth-mode login -o json > "$tmp/container.json"
python3 - "$tmp/container.json" <<'PY'
import json,sys
a=json.load(open(sys.argv[1]))
assert 'properties' in a and a['properties'].get('publicAccess') in (None,'None','off'), 'Container public access is not disabled'
PY
printf '%s' '{"version":1,"projectId":"vinhomes-saigon-park","storage":{"plotflow-design-assignments-r1":"{}"}}' > "$tmp/state.json"
exists="$(az storage blob exists --account-name "$account" --container-name "$container" --name "$blob" --auth-mode login --query exists -o tsv)"
if [[ "$exists" == false ]]; then
  az storage blob upload --account-name "$account" --container-name "$container" --name "$blob" --file "$tmp/state.json" --content-type application/json --overwrite false --auth-mode login --only-show-errors -o none
elif [[ "$exists" != true ]]; then
  echo 'Unknown blob existence; stopping.' >&2; exit 1
fi
az storage blob download --account-name "$account" --container-name "$container" --name "$blob" --file "$tmp/readback.json" --auth-mode login --only-show-errors -o none
cmp "$tmp/state.json" "$tmp/readback.json" || { echo 'Existing blob is not the exact synthetic fixture; refusing to modify it.' >&2; exit 1; }
endpoint="$(az storage account show -g "$rg" -n "$account" --query primaryEndpoints.blob -o tsv)"
url="${endpoint%/}/$container/$blob"
check_anonymous_denial() {
  local code
  code="$(curl --silent --show-error --max-time 20 --output "$tmp/anonymous.xml" --write-out '%{http_code}' "$1")"
  if [[ "$code" == 403 || "$code" == 404 ]]; then
    printf '%s' "$code"
  elif [[ "$code" == 409 ]] && grep -q '<Code>PublicAccessNotPermitted</Code>' "$tmp/anonymous.xml"; then
    printf '%s' "$code"
  else
    echo "Anonymous access unexpected HTTP $code" >&2
    return 1
  fi
}
code="$(check_anonymous_denial "$url")"
code_container="$(check_anonymous_denial "${endpoint%/}/$container?restype=container&comp=list")"
az storage account blob-service-properties show -g "$rg" -n "$account" -o json > "$tmp/properties.json"
python3 - "$tmp/properties.json" <<'PY'
import json,sys
p=json.load(open(sys.argv[1]))
assert p.get('isVersioningEnabled') is True
assert p.get('deleteRetentionPolicy',{}).get('enabled') is True
assert p.get('containerDeleteRetentionPolicy',{}).get('enabled') is True
print('PASS: versioning and soft-delete policies enabled')
PY
echo "PASS: anonymous blob GET HTTP $code; container list HTTP $code_container; authenticated readback matches fixture"
echo 'No SAS was generated. Configure the staging Worker separately using a short-lived user delegation SAS.'
