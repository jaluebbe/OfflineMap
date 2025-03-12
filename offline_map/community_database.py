import re
import sqlite3
from pathlib import Path
import point_in_geojson


script_dir = Path(__file__).parent
db_path = script_dir / "germany.db"
with open(script_dir / "communities_germany.json") as f:
    pig_communities = point_in_geojson.PointInGeoJSON(f.read())


def sqlite_regexp(expr, item):
    reg = re.compile(expr)
    return reg.search(item) is not None


def get_ags_metadata(ags: str) -> dict | None:
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM community_view
            WHERE ags = ?
            """,
            (ags,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_ags_metadata_with_plz(ags: str) -> dict | None:
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT l.plz, cv.*
            FROM location_ags_plz l
            JOIN community_view cv ON l.ags = cv.ags
            WHERE l.ags = ?
            """,
            (ags,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def get_ags_from_lat_lon(latitude: float, longitude: float) -> str | None:
    result = pig_communities.point_included_with_properties(longitude, latitude)
    return result[0]["ags"] if len(result) == 1 else None


def get_features_for_ags(ags: str) -> list[dict]:
    return pig_communities.features_with_property_str("ags", ags, "starts_with")


def query_community(search_term, case_insensitive=False, ags=""):
    search_term = re.escape(search_term)
    regex = f"^(?:|.*[ \\-]){search_term}.*$"
    if case_insensitive:
        regex = f"(?i){regex}"
    ags = ags.ljust(8, "_")
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        conn.create_function("REGEXP", 2, sqlite_regexp)
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM community_view
            WHERE community REGEXP ? AND ags LIKE ?
            """,
            (regex, ags),
        )
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results


def query_location(search_term, case_insensitive=False, ags="", plz=""):
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
            SELECT l.plz, cv.*
            FROM location_ags_plz l
            JOIN community_view cv ON l.ags = cv.ags
            WHERE community REGEXP ? AND l.ags LIKE ? AND l.plz LIKE ?
            """,
            (regex, ags, plz),
        )
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results


def query_distinct_location(
    search_term, case_insensitive=False, ags="", plz=""
):
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
            SELECT DISTINCT cv.*
            FROM location_ags_plz l
            JOIN community_view cv ON l.ags = cv.ags
            WHERE community REGEXP ? AND l.ags LIKE ? AND l.plz LIKE ?
            """,
            (regex, ags, plz),
        )
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results


def query_places(search_term, case_insensitive=False, ags="", plz=""):
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
            SELECT * FROM osm_places
            WHERE name REGEXP ? AND ags LIKE ? AND plz LIKE ?
            """,
            (regex, ags, plz),
        )
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results


def get_state_ags() -> dict:
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                CASE
                    WHEN nbd THEN bez || ' ' || gen
                    ELSE gen
                END AS concatenated,
                ags
            FROM states
            ORDER BY gen ASC
            """
        )
        rows = cursor.fetchall()
        return dict(rows)


def get_district_ags(ags: str = "") -> dict:
    ags = ags[:2].ljust(5, "_")
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                CASE
                    WHEN nbd THEN bez || ' ' || gen
                    ELSE gen
                END AS concatenated,
                ags
            FROM districts
            WHERE ags LIKE ?
            ORDER BY gen ASC
            """,
            (ags,),
        )
        rows = cursor.fetchall()
        return dict(rows)


def get_community_ags(ags: str = "") -> dict:
    ags = ags[:5].ljust(8, "_")
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                CASE
                    WHEN nbd THEN bez || ' ' || gen
                    ELSE gen
                END AS concatenated,
                ags
            FROM communities
            WHERE ags LIKE ?
            ORDER BY gen ASC
            """,
            (ags,),
        )
        rows = cursor.fetchall()
        return dict(rows)
