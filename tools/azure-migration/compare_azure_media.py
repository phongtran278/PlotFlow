"""Read-only Azure metadata comparison. Never uploads, deletes or reads project state."""
import argparse
import collections
import json
import os
import re
import subprocess
from pathlib import Path

ACCOUNT = "plotflowphong"
CONTAINER = "$web"
PREFIXES = ("assets/", "masterplan/")

def runtime_path(path):
    if not isinstance(path, str) or "\\" in path or any(part in ("", ".", "..") for part in path.split("/")):
        return None
    if path.startswith("app/public/"):
        path = path[len("app/public/"):]
    return path if path.startswith(PREFIXES) else None

def compare(inventory, blobs):
    if inventory.get("schemaVersion") != 1 or inventory.get("projectId") != "vinhomes-saigon-park" or inventory.get("mode") != "git-metadata-only":
        raise ValueError("Unexpected inventory identity")
    entries = inventory["entries"]
    if not entries or len(entries) != inventory["mediaFiles"]:
        raise ValueError("Incomplete inventory")
    remote = {}
    for blob in blobs:
        name, size = blob["name"], blob["bytes"]
        if not isinstance(name, str) or not name.startswith(PREFIXES) or not isinstance(size, int) or size < 0 or name in remote:
            raise ValueError("Invalid or duplicate Azure metadata")
        remote[name] = size
    rows = []
    counts = collections.Counter()
    groups = collections.defaultdict(collections.Counter)
    expected_names = set()
    for item in entries:
        name = runtime_path(item["path"])
        size = item["bytes"]
        if not isinstance(size, int) or size < 0:
            raise ValueError("Invalid source size")
        if item["kind"] == "lfs" and not re.fullmatch(r"[0-9a-f]{64}", item.get("sha256") or ""):
            raise ValueError("Invalid LFS SHA-256")
        if name is None:
            status = "no_direct_mapping"
        else:
            expected_names.add(name)
            if name not in remote:
                status = "not_listed_at_expected_path"
            elif remote[name] != size:
                status = "size_differs"
            else:
                status = "size_matches_hash_unverified"
        counts[status] += 1
        groups[item["group"]][status] += 1
        rows.append({"gitPath": item["path"], "candidateBlob": name, "expectedBytes": size,
                     "azureBytes": remote.get(name), "expectedLfsSha256": item.get("sha256"), "status": status})
    return {
        "schemaVersion": 1, "mode": "azure-metadata-only", "account": ACCOUNT, "container": CONTAINER,
        "commit": inventory["commit"], "publicationAllowed": False, "sha256Verified": False,
        "sourceEntries": len(entries), "azureMediaPrefixBlobs": len(remote),
        "distinctExpectedPaths": len(expected_names), "otherListedBlobs": len(remote.keys() - expected_names),
        "counts": dict(counts), "groups": {k: dict(v) for k,v in groups.items()}, "entries": rows,
    }

def list_azure():
    # Do not use inherited storage keys, SAS, alternate endpoints or connection strings.
    env = {k:v for k,v in os.environ.items() if not k.startswith("AZURE_STORAGE_")}
    rows = []
    for prefix in PREFIXES:
        result = subprocess.run(["az", "storage", "blob", "list", "--account-name", ACCOUNT,
            "--container-name", CONTAINER, "--auth-mode", "login", "--prefix", prefix,
            "--num-results", "*", "--only-show-errors", "--output", "json",
            "--query", "[].{name:name,bytes:properties.contentLength}"],
            env=env, check=False, capture_output=True, text=True, timeout=180)
        if result.returncode:
            raise RuntimeError("Azure read-only listing failed for " + prefix + "; check signed-in account and Blob Data Reader permissions. No key fallback.")
        data = json.loads(result.stdout)
        if not isinstance(data, list):
            raise ValueError("Unexpected Azure list response")
        rows.extend(data)
    return rows

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    if args.output.exists():
        raise FileExistsError("Choose a new output file")
    report = compare(inventory, list_azure())
    with args.output.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
    print(json.dumps({k:v for k,v in report.items() if k != "entries"}, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
