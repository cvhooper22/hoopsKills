"""Table Extractor: parse Sports-Reference HTML tables into raw rows.

Known gotcha (see countdownPlan.md): SR hides most secondary tables inside HTML
comments so they don't render by default. `iter_all_table_soup` pulls tables out
of both the live DOM and every comment node, so nothing silently disappears.

Every SR stat cell carries a `data-stat` attribute (e.g. `pts`, `fg3_pct`,
`date_game`). Rows are keyed by that attribute rather than by column position,
which is stable across SR's frequent layout tweaks.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from bs4 import BeautifulSoup, Comment, Tag


@dataclass
class Table:
    table_id: str
    caption: str
    rows: list[dict[str, str]] = field(default_factory=list)
    # parallel to rows: {data_stat: href} for any cell containing a link
    links: list[dict[str, str]] = field(default_factory=list)

    def __len__(self) -> int:  # pragma: no cover - trivial
        return len(self.rows)


def _make_soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def iter_all_table_soup(html: str):
    """Yield BeautifulSoup <table> tags from the live DOM and comment nodes."""
    soup = _make_soup(html)

    for table in soup.find_all("table"):
        yield table

    for comment in soup.find_all(string=lambda s: isinstance(s, Comment)):
        if "<table" not in comment:
            continue
        inner = _make_soup(comment)
        for table in inner.find_all("table"):
            yield table


def parse_table(table: Tag) -> Table:
    caption_tag = table.find("caption")
    caption = caption_tag.get_text(strip=True) if caption_tag else ""
    tbl = Table(table_id=table.get("id", ""), caption=caption)

    sections = [s for s in (table.find("tbody"), table.find("tfoot")) if s is not None] or [table]
    trs = [tr for section in sections for tr in section.find_all("tr", recursive=(section is table))]
    for tr in trs:
        classes = tr.get("class", [])
        if "thead" in classes or "over_header" in classes:
            continue  # repeated header row inside the body

        cells = tr.find_all(["th", "td"], recursive=False)
        if not cells:
            continue

        row: dict[str, str] = {}
        row_links: dict[str, str] = {}
        for cell in cells:
            stat = cell.get("data-stat")
            if not stat:
                continue
            row[stat] = cell.get_text(strip=True)
            link = cell.find("a")
            if link and link.get("href"):
                row_links[stat] = link["href"]

        if row:
            tbl.rows.append(row)
            tbl.links.append(row_links)

    return tbl


def extract_tables(html: str) -> dict[str, Table]:
    """Return {table_id: Table} for every table on the page (comments included).

    Tables without an id are keyed as `_anon_{n}` so they're still reachable.
    """
    out: dict[str, Table] = {}
    anon = 0
    for raw in iter_all_table_soup(html):
        parsed = parse_table(raw)
        key = parsed.table_id
        if not key:
            key = f"_anon_{anon}"
            anon += 1
        if key in out:  # comment + live copy of the same table; keep the fuller one
            if len(parsed) <= len(out[key]):
                continue
        out[key] = parsed
    return out
