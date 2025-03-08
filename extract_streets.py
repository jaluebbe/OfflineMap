import re
import csv
import sqlite3
import osmium as osm
import requests
from shapely import MultiPoint, Point
from offline_map.community_database import get_ags_from_lat_lon
from offline_map.post_code_database import get_plz_from_lat_lon

ignore_street_regex = re.compile(r"^(\?|\+|-|_|\d*|\(.*\))$")
ignore_streets_url = "https://raw.githubusercontent.com/openpotato/openplzapi.data/refs/heads/main/src/de/osm/streets.ignore.csv"


def download_ignore_streets(url):
    response = requests.get(url)
    response.raise_for_status()
    return response.text


def load_ignore_streets(csv_content):
    reader = csv.DictReader(csv_content.splitlines())
    return {
        (
            row["Name"].strip(),
            row["PostalCode"].strip(),
            row["RegionalKey"].strip(),
        )
        for row in reader
    }


ignore_streets_csv = download_ignore_streets(ignore_streets_url)
ignore_streets = load_ignore_streets(ignore_streets_csv)


def simplify_locations(locations):
    multipoint = MultiPoint(locations)
    centroid = multipoint.centroid
    return min(locations, key=lambda point: Point(point).distance(centroid))


def should_include_way(tags):
    if not "name" in tags:
        return False
    if tags.get("indoor") and tags["indoor"] != "no":
        return False
    if tags["name"].startswith(('"', "-", "(")):
        return False
    if ignore_street_regex.match(tags["name"]):
        return False
    if tags.get("access") in ["private", "forestry", "military"]:
        return False
    if "highway" in tags:
        if tags["highway"] in [
            "primary",
            "secondary",
            "tertiary",
            "residential",
            "living_street",
            "road",
            "unclassified",
            "footway",
            "pedestrian",
        ]:
            return True
        if tags["highway"] == "track" and tags.get("tracktype") == "grade1":
            return True
        if tags["highway"] == "service" and tags.get("service") == "alley":
            return True
    return False


class HighwayHandler(osm.SimpleHandler):
    def __init__(self, db_conn):
        super().__init__()
        self.db_conn = db_conn
        self.cursor = db_conn.cursor()

    def way(self, w):
        if not should_include_way(w.tags):
            return
        locations = [
            (n.location.lat, n.location.lon)
            for n in w.nodes
            if n.location.valid()
        ]
        if not locations:
            return
        location = simplify_locations(locations)
        ags = get_ags_from_lat_lon(*location)
        plz = get_plz_from_lat_lon(*location)
        if None in (ags, plz):
            return
        if (w.tags["name"], plz, ags) in ignore_streets:
            return
        self.cursor.execute(
            """
            INSERT OR REPLACE INTO highways (way_id, name, highway, ags, plz, latitude, longitude)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                w.id,
                w.tags["name"],
                w.tags["highway"],
                ags,
                plz,
                round(location[0], 5),
                round(location[1], 5),
            ),
        )
        self.db_conn.commit()


def create_combined_streets_table(db_conn):
    cursor = db_conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS combined_streets (
            name TEXT,
            ags TEXT,
            plz TEXT,
            latitude REAL,
            longitude REAL
        )
        """
    )
    cursor.execute(
        """
        SELECT name, ags, plz, GROUP_CONCAT(latitude || ' ' || longitude) AS locations
        FROM highways
        GROUP BY name, ags, plz
        """
    )
    rows = cursor.fetchall()
    for name, ags, plz, locations in rows:
        locations = [
            (float(lon), float(lat))
            for lat, lon in (loc.split() for loc in locations.split(","))
        ]
        simplified_location = simplify_locations(locations)
        cursor.execute(
            """
            INSERT INTO combined_streets (name, ags, plz, latitude, longitude)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                name,
                ags,
                plz,
                round(simplified_location[1], 5),
                round(simplified_location[0], 5),
            ),
        )
    db_conn.commit()


def main(input_file, db_file):
    with sqlite3.connect(db_file) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS highways (
                way_id INTEGER PRIMARY KEY,
                name TEXT,
                highway TEXT,
                ags TEXT,
                plz TEXT,
                latitude REAL,
                longitude REAL
            )
        """
        )
        conn.commit()
        handler = HighwayHandler(conn)
        handler.apply_file(input_file, locations=True)
        create_combined_streets_table(conn)
    print(f"Data has been stored in {db_file}.")


if __name__ == "__main__":
    main("germany.osm.pbf", "osm_way_highways.db")
