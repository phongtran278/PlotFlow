import unittest
from compare_azure_media import compare, runtime_path

def fixture():
    rows = [
        ("assets/houses/a.png", 100, "source-assets"),
        ("app/public/masterplan/generated/page-tiles/1/0_0.webp", 20, "page-tiles"),
        ("masterplan/masterplan.pdf", 500, "masterplan"),
        ("references/ref.png", 12, "legacy-or-reference"),
    ]
    return {"schemaVersion":1,"projectId":"vinhomes-saigon-park","mode":"git-metadata-only",
            "commit":"fixture","mediaFiles":len(rows),"entries":[
              {"path":p,"bytes":n,"group":g,"kind":"lfs","sha256":"a"*64} for p,n,g in rows]}

class ComparisonTests(unittest.TestCase):
    def test_mapping_is_allowlisted(self):
        self.assertEqual(runtime_path("app/public/masterplan/a.pdf"),"masterplan/a.pdf")
        self.assertEqual(runtime_path("assets/houses/a.png"),"assets/houses/a.png")
        for p in ["plotflow-projects/vinhomes-saigon-park/state.json","app/public/../assets/a.png","assets/../state.json","references/ref.png","app/public/index.html"]:
            self.assertIsNone(runtime_path(p))
    def test_size_only_and_missing(self):
        report=compare(fixture(),[{"name":"assets/houses/a.png","bytes":100},{"name":"masterplan/masterplan.pdf","bytes":501},{"name":"assets/extra.png","bytes":5}])
        self.assertEqual(report["counts"],{"size_matches_hash_unverified":1,"not_listed_at_expected_path":1,"size_differs":1,"no_direct_mapping":1})
        self.assertFalse(report["sha256Verified"])
        self.assertFalse(report["publicationAllowed"])
        self.assertEqual(report["otherListedBlobs"],1)
    def test_bad_remote_records_fail(self):
        for bad in [[{"name":"state.json","bytes":1}],[{"name":"assets/x","bytes":-1}],[{"name":"assets/x","bytes":1}]*2]:
            with self.assertRaises(ValueError):
                compare(fixture(),bad)
    def test_bad_inventory_fails(self):
        data=fixture()
        data["projectId"]="other"
        with self.assertRaises(ValueError):
            compare(data,[])
if __name__=="__main__":
    unittest.main()
