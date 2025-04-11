import sqlite3
from pathlib import Path

script_dir = Path(__file__).parent
db_path = script_dir / "germany.db"


def query_streets(search_term, case_insensitive=False, ags="", plz=""):
    search_term = f"%{search_term}%"
    ags = ags.ljust(8, "_")
    plz = plz.ljust(5, "_")
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        cursor = conn.cursor()
        if not case_insensitive:
            cursor.execute("PRAGMA case_sensitive_like = ON;")
        cursor.execute(
            """
            SELECT * FROM osm_streets
            WHERE name LIKE ? AND ags LIKE ? AND plz LIKE ?
            """,
            (search_term, ags, plz),
        )
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
