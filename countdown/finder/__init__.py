"""BYU Hoops Countdown stat finder.

Pipeline modules are deliberately independent so a future UI can call
match/rank/draft directly against cached facts without re-running scrape logic:

    fetcher    -- fetch Sports-Reference pages, cache raw HTML locally
    extractor  -- parse HTML tables, including the ones SR hides in comments
    normalizer -- turn raw table rows into flat, tagged Fact records
    models     -- the Fact record shape + the local facts store
"""

from .config import load_config

__all__ = ["load_config"]
