import unittest
from compare_azure_media import compare, runtime_path

def fixture():
    rows = [
        ("assets/houses/a.png", 100, "source-assets"),
        ("app/public/masterplan/generated/page-tiles/1/0_0.webp", 20, "page-tiles"),
        ("masterplan/masterplan.pdf", 500, "masterplan"),
        ("app/public/overview-masterplan/gian-xay.pdf", 600, "public-assets"),
        ("assets/font/SVNGilroy Bold.otf", 102104, "source-assets"),
        ("app/public/assets/font/SVN-Gilroy-Bold.otf", 104096, "public-assets"),
        ("references/ref.png", 12, "legacy-or-reference"),
        ("PlotFlow_ROUND1_FINAL_RECOVERY_06/COPY_INTO_APP/public/assets/ui/logo_gold.png", 200, "legacy-or-reference"),
    ]
    return {"schemaVersion":1,"projectId":"vinhomes-saigon-park","mode":"git-metadata-only",
            "commit":"fixture","mediaFiles":len(rows),"entries":[
              {"path":p,"bytes":n,"group":g,"kind":"lfs","sha256":(str(i+1)*64)[:64],"gitObject":None}
              for i,(p,n,g) in enumerate(rows)]}

class ComparisonTests(unittest.TestCase):
    def test_mapping_is_allowlisted(self):
        self.assertEqual(runtime_path("app/public/masterplan/a.pdf"),"masterplan/a.pdf")
        self.assertEqual(runtime_path("app/public/overview-masterplan/gian-xay.pdf"),"overview-masterplan/gian-xay.pdf")
        self.assertEqual(runtime_path("app/public/assets/font/SVN-Gilroy-Bold.otf"),"assets/font/SVNGilroy Bold.otf")
        self.assertEqual(runtime_path("assets/houses/a.png"),"assets/houses/a.png")
        for p in ["plotflow-projects/vinhomes-saigon-park/state.json","app/public/../assets/a.png","assets/../state.json","references/ref.png","app/public/index.html"]:
            self.assertIsNone(runtime_path(p))
    def test_size_only_and_missing(self):
        inv=fixture()
        blobs=[{"name":"assets/houses/a.png","bytes":100},{"name":"masterplan/masterplan.pdf","bytes":501},
               {"name":"overview-masterplan/gian-xay.pdf","bytes":600},{"name":"assets/font/SVNGilroy Bold.otf","bytes":102104}]
        report=compare(inv,blobs)
        self.assertEqual(report["counts"],{"size_matches_hash_unverified":4,"not_listed_at_expected_path":1,"size_differs":1,"no_direct_mapping":2})
        alias=next(r for r in report["entries"] if r["buildAlias"])
        self.assertEqual(alias["resolvedGitPath"],"assets/font/SVNGilroy Bold.otf")
        self.assertEqual(alias["runtimeExpectedBytes"],102104)
        self.assertFalse(report["sha256Verified"])
        self.assertFalse(report["publicationAllowed"])
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
