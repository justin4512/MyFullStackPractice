"""Filesystem integration tests for the static portfolio export CLI.

Run with: python3 -m unittest discover -s tests -p 'test_profile_build.py' -v
"""

from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/build-profile.py"
PAGE_PATHS = {
    "index.html",
    "projects/index.html",
    "projects/clinic-scheduling/index.html",
    "projects/iceland-map/index.html",
    "cases/private-ai/index.html",
    "cases/geospatial-platform/index.html",
    "cases/workflow-automation/index.html",
    "notes/index.html",
    "notes/equivalent-work-hours/index.html",
}


class DocumentLinks(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.references = []
        self.canonicals = []
        self.downloads = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attribute in ("href", "src"):
            if attrs.get(attribute):
                self.references.append(attrs[attribute])
        if tag == "link" and "canonical" in attrs.get("rel", "").split():
            self.canonicals.append(attrs.get("href"))
        if tag == "a" and "download" in attrs:
            self.downloads.append(attrs.get("href"))


class ProfileBuildTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="profile-build-test-")
        self.addCleanup(self.temporary.cleanup)
        self.output = Path(self.temporary.name)

    def build(self, site_url=None):
        command = [sys.executable, str(BUILDER), "--output", str(self.output)]
        if site_url is not None:
            command.extend(["--site-url", site_url])
        return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, timeout=30)

    def snapshot(self):
        return {
            path.relative_to(self.output).as_posix(): path.read_bytes()
            for path in self.output.rglob("*") if path.is_file()
        }

    def assert_success(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_unrelated_html_rejects_before_overwriting_assets(self):
        (self.output / "index.html").write_bytes(b"Unrelated home page\x00")
        (self.output / "css").mkdir()
        (self.output / "css/myAll.css").write_bytes(b"/* Unrelated stylesheet */")
        before = self.snapshot()

        result = self.build()

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(self.snapshot() == before, "Rejected export must preserve all existing bytes and create no files")
        self.assertFalse((self.output / "js").exists())

    def test_unrelated_publish_metadata_rejects_before_any_writes(self):
        for filename in ("robots.txt", "sitemap.xml"):
            with self.subTest(filename=filename), tempfile.TemporaryDirectory(prefix="profile-metadata-test-") as directory:
                self.output = Path(directory)
                (self.output / filename).write_bytes(b"Unrelated metadata must survive\n")
                before = self.snapshot()

                result = self.build("https://example.test")

                self.assertEqual(
                    (result.returncode == 0, self.snapshot() == before),
                    (False, True),
                    "Conflicting metadata must reject the export before modifying or creating files",
                )
                self.assertFalse((self.output / "js").exists())

    def test_clean_local_export_has_nine_pages_and_resolvable_links(self):
        self.assert_success(self.build())
        pages = {path.relative_to(self.output).as_posix() for path in self.output.rglob("*.html")}
        self.assertEqual(pages, PAGE_PATHS)
        for page in sorted(pages):
            with self.subTest(page=page):
                document = DocumentLinks((self.output / page).read_text(encoding="utf-8"))
                self.assertEqual(document.canonicals, [])
                self.assertGreaterEqual(len(document.downloads), 1)
                for download in document.downloads:
                    target = (self.output / page).parent / unquote(urlsplit(download).path)
                    self.assertEqual(target.suffix, ".docx")
                    self.assertGreater(target.stat().st_size, 0)
                for reference in document.references:
                    parsed = urlsplit(reference)
                    if parsed.scheme or parsed.netloc or not parsed.path:
                        continue
                    target = (self.output / page).parent / unquote(parsed.path)
                    self.assertTrue(target.is_file(), f"Broken local reference in {page}: {reference}")
        self.assertFalse((self.output / "sitemap.xml").exists())
        self.assertFalse((self.output / "robots.txt").exists())

    def test_publish_urls_and_repeat_export_support_root_and_path_prefix(self):
        for site_url in ("https://example.test", "https://example.test/portfolio/"):
            with self.subTest(site_url=site_url):
                self.assert_success(self.build(site_url))
                expected_urls = {site_url.rstrip("/") + "/" + page.removesuffix("index.html") for page in PAGE_PATHS}
                for page in PAGE_PATHS:
                    document = DocumentLinks((self.output / page).read_text(encoding="utf-8"))
                    self.assertEqual(document.canonicals, [site_url.rstrip("/") + "/" + page.removesuffix("index.html")])
                sitemap = ET.parse(self.output / "sitemap.xml")
                locations = [element.text for element in sitemap.findall("{http://www.sitemaps.org/schemas/sitemap/0.9}url/{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
                self.assertEqual(len(locations), 9)
                self.assertEqual(set(locations), expected_urls)
                self.assertIn("Sitemap: " + site_url.rstrip("/") + "/sitemap.xml", (self.output / "robots.txt").read_text())
                before = self.snapshot()
                self.assert_success(self.build(site_url))
                self.assertTrue(self.snapshot() == before, "Rebuilding owned output must preserve the generated content")


if __name__ == "__main__":
    unittest.main()
