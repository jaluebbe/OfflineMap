import re
import sqlite3
from pathlib import Path

script_dir = Path(__file__).parent
db_path = script_dir / "germany.db"


def sqlite_regexp(expr, item):
    reg = re.compile(expr)
    return reg.search(item) is not None


def query_streets(search_term, case_insensitive=False, ags="", plz=""):
    search_term = re.escape(search_term)
    regex = f"^(?:|.*[ \\-]){search_term}.*$"
    if case_insensitive:
        regex = f"(?i){regex}"
    ags = ags.ljust(8, "_")
    plz = plz.ljust(5, "_")
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        conn.create_function("REGEXP", 2, sqlite_regexp)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM osm_streets
            WHERE name REGEXP ? AND ags LIKE ? AND plz LIKE ?
            """,
            (regex, ags, plz),
        )
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
