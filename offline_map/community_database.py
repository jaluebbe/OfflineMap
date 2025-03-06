import sqlite3
from pathlib import Path
import point_in_geojson


script_dir = Path(__file__).parent
db_path = script_dir / "germany.db"
with open(script_dir / "communities_germany.json") as f:
    pig_communities = point_in_geojson.PointInGeoJSON(f.read())


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
