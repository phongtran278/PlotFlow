"""Hash existing Azure media by read-only authenticated GET; no LFS download or writes."""
import argparse
import collections
import concurrent.futures
import email.utils
import hashlib
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from compare_azure_media import runtime_path, ACCOUNT, CONTAINER

ORIGIN = "https://plotflowphong.blob.core.windows.net"
MEDIA = re.compile(r"\.(png|jpe?g|webp|pdf|otf|ttf|woff2?)$", re.I)
MAX_BYTES = 256 * 1024 * 1024

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def safe_name(path):
    name = runtime_path(path)
    if not name or not MEDIA.search(name) or any(ord(ch) < 32 or ord(ch) == 127 for ch in name):
        return None
    return name

def build_tasks(inventory, comparison):
    if (inventory.get("schemaVersion") != 1 or inventory.get("mode") != "git-metadata-only"
        or inventory.get("projectId") != "vinhomes-saigon-park"
        or comparison.get("mode") != "azure-metadata-only"
        or comparison.get("account") != ACCOUNT or comparison.get("container") != CONTAINER
        or inventory.get("commit") != comparison.get("commit")):
        raise ValueError("Inventory/comparison identity mismatch")
    entries = inventory["entries"]
    by_path = {item["path"]:item for item in entries}
    rows = comparison["entries"]
    if len(entries) != inventory["mediaFiles"] or len(rows) != len(entries):
        raise ValueError("Incomplete inventory/comparison")
    tasks, exceptions = {}, []
    for item, row in zip(entries, rows):
        if item["path"] != row["gitPath"] or item["bytes"] != row["expectedBytes"] or row["candidateBlob"] != runtime_path(item["path"]):
            raise ValueError("Comparison row mismatch")
        resolved_path = row.get("resolvedGitPath", item["path"])
        source = by_path.get(resolved_path)
        if source is None or source["kind"] != row.get("resolvedKind"):
            raise ValueError("Resolved source mismatch")
        expected = source.get("sha256") if source["kind"] == "lfs" else source.get("gitObject")
        if expected != row.get("resolvedDigest"):
            raise ValueError("Resolved digest mismatch")
        status = row["status"]
        if status != "size_matches_hash_unverified":
            if status not in ("size_differs", "no_direct_mapping", "not_listed_at_expected_path"):
                raise ValueError("Unexpected comparison status")
            exceptions.append({"path":item["path"],"blob":row["candidateBlob"],"status":status,
                               "expectedBytes":item["bytes"],"runtimeExpectedBytes":row.get("runtimeExpectedBytes"),
                               "azureBytes":row["azureBytes"],"resolvedGitPath":resolved_path,
                               "unmappedReason":row.get("unmappedReason")})
            continue
        name, size = safe_name(item["path"]), row.get("runtimeExpectedBytes", item["bytes"])
        if not name or not isinstance(size, int) or not 0 <= size <= MAX_BYTES or row["azureBytes"] != size:
            raise ValueError("Unsafe or invalid media read")
        kind = source["kind"]
        if kind not in ("lfs","git-blob") or not isinstance(expected,str) or not re.fullmatch(r"[0-9a-f]{64}" if kind == "lfs" else r"[0-9a-f]{40}",expected):
            raise ValueError("Invalid expected digest")
        task = tasks.setdefault(name, {"blob":name,"bytes":size,"expected":[]})
        if task["bytes"] != size:
            raise ValueError("Conflicting blob size")
        task["expected"].append({"path":item["path"],"resolvedPath":resolved_path,"kind":kind,"digest":expected})
    return list(tasks.values()), exceptions

def hash_stream(stream, size):
    sha = hashlib.sha256()
    gitsha = hashlib.sha1()
    gitsha.update(("blob "+str(size)+"\0").encode("ascii"))
    received = 0
    while True:
        chunk = stream.read(1024*1024)
        if not chunk:
            break
        received += len(chunk)
        if received > size:
            raise ValueError("Unexpected content length")
        sha.update(chunk)
        gitsha.update(chunk)
    if received != size:
        raise ValueError("Unexpected content length")
    return sha.hexdigest(), gitsha.hexdigest()

def verify_task(task, token):
    url = ORIGIN + "/$web/" + urllib.parse.quote(task["blob"], safe="/")
    request = urllib.request.Request(url, headers={
        "Authorization":"Bearer "+token,
        "x-ms-version":"2023-11-03",
        "x-ms-date":email.utils.formatdate(usegmt=True),
        "Accept-Encoding":"identity",
    }, method="GET")
    last = "request_failed"
    for attempt in range(3):
        try:
            with urllib.request.build_opener(NoRedirect()).open(request, timeout=35) as response:
                if response.status != 200 or response.headers.get("Content-Length") != str(task["bytes"]):
                    raise ValueError("Unexpected content length")
                sha, gitsha = hash_stream(response,task["bytes"])
            return [{"path":e["path"],"blob":task["blob"],"sha256":sha,"gitBlobSha1":gitsha,
                     "status":"verified"} for e in task["expected"]]
        except urllib.error.HTTPError as exc:
            last = "http_"+str(exc.code)
            if exc.code not in (408,429,500,502,503,504):
                break
        except (OSError, ValueError) as exc:
            last = type(exc).__name__
        if attempt < 2:
            time.sleep(1+attempt)
    return [{"path":e["path"],"blob":task["blob"],"status":last} for e in task["expected"]]

def load_previous(path, commit):
    if path is None:
        return {}
    report=json.loads(path.read_text(encoding="utf-8"))
    if report.get("mode") != "azure-read-only-content-verification" or report.get("commit") != commit:
        raise ValueError("Previous verification does not match inventory commit")
    rows=report.get("entries")
    if not isinstance(rows,list):
        raise ValueError("Previous verification has no entries")
    return {row["path"]:row for row in rows if isinstance(row,dict) and isinstance(row.get("path"),str)}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory",type=Path)
    parser.add_argument("comparison",type=Path)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--previous-verification",type=Path)
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("Choose a new output file")
    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    comparison = json.loads(args.comparison.read_text(encoding="utf-8"))
    tasks, exceptions = build_tasks(inventory,comparison)
    previous = load_previous(args.previous_verification,inventory["commit"])
    rows = list(exceptions)
    pending = []
    reused = 0
    for task in tasks:
        remaining = []
        for expected in task["expected"]:
            prior = previous.get(expected["resolvedPath"])
            matches = (prior and prior.get("status") == "verified" and prior.get("blob") == task["blob"]
                and ((expected["kind"] == "lfs" and prior.get("sha256") == expected["digest"])
                     or (expected["kind"] == "git-blob" and prior.get("gitBlobSha1") == expected["digest"])))
            if matches:
                rows.append({"path":expected["path"],"blob":task["blob"],"sha256":prior["sha256"],
                             "gitBlobSha1":prior.get("gitBlobSha1"),"status":"verified","reusedPreviousVerification":True,
                             "reusedFrom":expected["resolvedPath"]})
                reused += 1
            else:
                remaining.append(expected)
        if remaining:
            pending.append({**task,"expected":remaining})
    token = None
    if pending:
        token = subprocess.run(["az","account","get-access-token","--resource","https://storage.azure.com/","--query","accessToken","-o","tsv"],check=True,capture_output=True,text=True,timeout=60).stdout.strip()
        if not token or any(c.isspace() for c in token):
            raise ValueError("Invalid access token")
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        if pending:
            first = verify_task(pending[0],token)
            if any(r["status"] not in ("verified","hash_mismatch") for r in first):
                raise RuntimeError("First read failed: "+first[0]["status"]+"; no credentials printed")
            rows.extend(first)
            for index,result in enumerate(pool.map(lambda t:verify_task(t,token),pending[1:]),start=2):
                rows.extend(result)
                if index % 500 == 0:
                    print("Checked "+str(index)+" / "+str(len(pending))+" blob paths",file=sys.stderr,flush=True)
    counts = dict(collections.Counter(row["status"] for row in rows))
    report = {"schemaVersion":1,"mode":"azure-read-only-content-verification","commit":inventory["commit"],
              "blobReadsPlanned":len(pending),"reusedVerified":reused,"sourceEntries":len(rows),"counts":counts,
              "allEntriesVerified":len(rows)==inventory["mediaFiles"] and counts.get("verified",0)==len(rows),
              "publicationAllowed":False,"entries":rows}
    with args.output.open("x",encoding="utf-8") as f:
        json.dump(report,f,ensure_ascii=False,indent=2)
    unresolved=[row for row in rows if row["status"]!="verified"]
    print(json.dumps({k:v for k,v in report.items() if k!="entries"},ensure_ascii=False,indent=2))
    print(json.dumps({"unresolvedFirst30":unresolved[:30],"unresolvedTotal":len(unresolved)},ensure_ascii=False,indent=2))
if __name__ == "__main__":
    main()
