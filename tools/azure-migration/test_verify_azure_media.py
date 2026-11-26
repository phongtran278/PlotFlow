import hashlib
import io
import unittest
from verify_azure_media import build_tasks, hash_stream, safe_name
from compare_azure_media import compare
from test_compare_azure_media import fixture

class VerificationTests(unittest.TestCase):
    def test_hash_content_and_git_blob(self):
        b=b"sample"
        self.assertEqual(hash_stream(io.BytesIO(b),len(b)),(hashlib.sha256(b).hexdigest(),hashlib.sha1(b"blob 6\0"+b).hexdigest()))
        for n in (1,9):
            with self.assertRaises(ValueError):
                hash_stream(io.BytesIO(b),n)
    def test_safe_blob_paths(self):
        self.assertEqual(safe_name("app/public/masterplan/a.pdf"),"masterplan/a.pdf")
        self.assertEqual(safe_name("app/public/overview-masterplan/a.pdf"),"overview-masterplan/a.pdf")
        for name in ["assets/../state.json","plotflow-projects/vinhomes-saigon-park/state.json","assets/state.json","assets/a\n.png"]:
            self.assertIsNone(safe_name(name))
    def test_only_matching_rows_selected_and_exceptions_preserved(self):
        inv=fixture()
        blobs=[{"name":"assets/houses/a.png","bytes":100},{"name":"masterplan/masterplan.pdf","bytes":501},
               {"name":"overview-masterplan/gian-xay.pdf","bytes":600},{"name":"assets/font/SVNGilroy Bold.otf","bytes":102104}]
        report=compare(inv,blobs)
        tasks,exceptions=build_tasks(inv,report)
        self.assertEqual(len(tasks),3)
        self.assertEqual({t["blob"] for t in tasks},{"assets/houses/a.png","overview-masterplan/gian-xay.pdf","assets/font/SVNGilroy Bold.otf"})
        self.assertEqual(len(exceptions),4)
        self.assertEqual({r["status"] for r in exceptions},{"size_differs","no_direct_mapping","not_listed_at_expected_path"})
        alias=next(t for t in tasks if t["blob"]=="assets/font/SVNGilroy Bold.otf")
        self.assertTrue(any(e["path"]=="app/public/assets/font/SVN-Gilroy-Bold.otf" and e["resolvedPath"]=="assets/font/SVNGilroy Bold.otf" for e in alias["expected"]))
    def test_identity_or_path_tampering_fails(self):
        inv=fixture()
        report=compare(inv,[])
        report["commit"]="different"
        with self.assertRaises(ValueError):
            build_tasks(inv,report)
        report=compare(inv,[])
        report["entries"][0]["candidateBlob"]="assets/another.png"
        with self.assertRaises(ValueError):
            build_tasks(inv,report)
if __name__=="__main__":
    unittest.main()
