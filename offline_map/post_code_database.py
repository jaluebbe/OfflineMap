from pathlib import Path
import point_in_geojson

script_dir = Path(__file__).parent
with open(script_dir / "post_codes_germany.json") as f:
    pig_communities = point_in_geojson.PointInGeoJSON(f.read())


def get_plz_from_lat_lon(latitude, longitude):
    result = pig_communities.point_included_with_properties(longitude, latitude)
    if len(result) == 1:
        return result[0]["plz"]
