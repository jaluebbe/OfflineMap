import sqlite3
from pathlib import Path
import point_in_geojson


script_dir = Path(__file__).parent
with open(script_dir / "communities_germany.json") as f:
    pig_communities = point_in_geojson.PointInGeoJSON(f.read())


def get_ags_metadata(ags):
    db_path = script_dir / "germany.db"
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
        if row:
            return dict(row)


def get_ags_from_lat_lon(latitude, longitude):
    result = pig_communities.point_included_with_properties(longitude, latitude)
    if len(result) == 1:
        return result[0]["ags"]
