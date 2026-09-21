"""Fetcher: pull Sports-Reference pages, cache raw HTML on disk.

Caching philosophy (see countdownPlan.md): most of this data is historical and
doesn't change once scraped. The cache is treated as durable, not TTL'd. Nothing
here re-fetches on its own -- a cache hit is always returned as-is unless the
caller explicitly passes force=True.

Sports-Reference is aggressive about rate limiting (roughly 20 requests/minute
before a temporary block), so every network fetch is spaced out by
`min_interval_seconds` and a 429 is honoured with its Retry-After.
"""

from __future__ import annotations

import time
from pathlib import Path

import requests

from .config import REPO_ROOT, load_config

CACHE_ROOT = REPO_ROOT / "cache"


class Fetcher:
    def __init__(
        self,
        cache_root: Path | str = CACHE_ROOT,
        min_interval_seconds: float | None = None,
        user_agent: str | None = None,
        base_url: str | None = None,
    ) -> None:
        cfg = load_config().get("fetch", {})
        self.cache_root = Path(cache_root)
        self.min_interval = (
            min_interval_seconds
            if min_interval_seconds is not None
            else cfg.get("min_interval_seconds", 3.5)
        )
        self.base_url = (base_url or cfg.get("base_url", "https://www.sports-reference.com")).rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": user_agent or cfg.get("user_agent", "byu-hoops-countdown/0.1")}
        )
        self._last_request_at = 0.0

    # -- public API ---------------------------------------------------------

    def fetch(self, path: str, cache_key: str, force: bool = False) -> str:
        """Return page HTML for `path`, reading the local cache unless `force`.

        `path` is a site-relative path like "/cbb/players/foo-1.html".
        `cache_key` is a relative cache location like "foo-1/overview.html".
        """
        cache_path = self.cache_root / cache_key
        if cache_path.exists() and not force:
            return cache_path.read_text(encoding="utf-8")

        html = self._download(path)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(html, encoding="utf-8")
        return html

    def fetch_post(self, url: str, cache_key: str, json_body: dict, force: bool = False) -> str:
        """POST `json_body` to `url`, cache and return the response body text.

        Same durable cache + rate limiting as `fetch`. Used for eurobasket's
        per-season stats endpoint (an ASP.NET `{"d": "<html>"}` JSON wrapper).
        """
        cache_path = self.cache_root / cache_key
        if cache_path.exists() and not force:
            return cache_path.read_text(encoding="utf-8")

        self._respect_rate_limit()
        resp = self.session.post(url, json=json_body, timeout=30)
        self._last_request_at = time.monotonic()
        resp.raise_for_status()

        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(resp.text, encoding="utf-8")
        return resp.text

    def is_cached(self, cache_key: str) -> bool:
        return (self.cache_root / cache_key).exists()

    # -- internals --------------------------------------------------------

    def _download(self, path: str) -> str:
        url = path if path.startswith("http") else f"{self.base_url}{path}"
        self._respect_rate_limit()

        resp = self.session.get(url, timeout=30)
        self._last_request_at = time.monotonic()

        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", "60"))
            print(f"  429 from Sports-Reference, waiting {wait}s then retrying {url}")
            time.sleep(wait + 1)
            self._last_request_at = time.monotonic()
            resp = self.session.get(url, timeout=30)

        resp.raise_for_status()
        return resp.text

    def _respect_rate_limit(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
