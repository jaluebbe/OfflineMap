import sqlite3
from pathlib import Path
import point_in_geojson

script_dir = Path(__file__).parent
with open(script_dir / "post_codes_germany.json") as f:
    pig_post_codes = point_in_geojson.PointInGeoJSON(f.read())


def get_plz_from_lat_lon(latitude, longitude):
    result = pig_post_codes.point_included_with_properties(longitude, latitude)
    if len(result) == 1:
        return result[0]["plz"]


def get_features_for_plz(plz: str) -> list[dict]:
    return pig_post_codes.features_with_property_str("plz", plz, "starts_with")


def get_metadata_for_plz(plz: str) -> dict:
    db_path = script_dir / "germany.db"
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT name, ags, plz
            FROM location_ags_plz
            WHERE plz = ?
            """,
            (plz,),
        )
        row = cursor.fetchall()
        return [dict(row) for row in row]


def get_names_for_plz(plz: str) -> list[str]:
    db_path = script_dir / "germany.db"
    with sqlite3.connect(f"file:{db_path}?mode=ro", uri=True) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT name
            FROM location_ags_plz
            WHERE plz = ?
            """,
            (plz,),
        )
        rows = cursor.fetchall()
        return [row[0] for row in rows]
