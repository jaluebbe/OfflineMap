import sqlite3
import osmium as osm
from offline_map.community_database import get_ags_from_lat_lon
from offline_map.post_code_database import get_plz_from_lat_lon


class PlaceHandler(osm.SimpleHandler):
    def __init__(self, db_conn):
        super().__init__()
        self.db_conn = db_conn
        self.cursor = db_conn.cursor()

    def node(self, n):
        if (
            "place" in n.tags
            and n.tags["place"]
            in [
                "village",
                "suburb",
                "quarter",
                "neighbourhood",
            ]
            and n.tags.get("name") is not None
        ):
            name = n.tags["name"]
            ags = get_ags_from_lat_lon(n.location.lat, n.location.lon)
            plz = get_plz_from_lat_lon(n.location.lat, n.location.lon)
            if None in (ags, plz):
                return
            self.cursor.execute(
                """
                INSERT OR REPLACE INTO places (
                    node_id,
                    name,
                    place,
                    ags,
                    plz,
                    latitude,
                    longitude
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    n.id,
                    name,
                    n.tags["place"],
                    ags,
                    plz,
                    round(n.location.lat, 5),
                    round(n.location.lon, 5),
                ),
            )
            self.db_conn.commit()


def create_filtered_places(osm_db_file, germany_db_file):
    with sqlite3.connect(osm_db_file) as osm_conn, sqlite3.connect(
        germany_db_file
    ) as germany_conn:
        germany_cursor = germany_conn.cursor()
        germany_cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS osm_places (
                node_id INTEGER PRIMARY KEY,
                name TEXT,
                place TEXT,
                ags TEXT,
                plz TEXT,
                latitude REAL,
                longitude REAL
            )
            """
        )
        germany_cursor.execute("SELECT name, ags, plz FROM location_ags_plz")
        name_ags_plz = set(germany_cursor.fetchall())
        germany_cursor.execute("SELECT community, ags FROM community_view")
        community_ags_plz = set(germany_cursor.fetchall())
        osm_cursor = osm_conn.cursor()
        osm_cursor.execute("SELECT * FROM places")
        places_rows = osm_cursor.fetchall()
        for row in places_rows:
            node_id, name, place, ags, plz, latitude, longitude = row
            if (name, ags, plz) not in name_ags_plz and (
                name,
                ags,
            ) not in community_ags_plz:
                germany_cursor.execute(
                    """
                    INSERT OR REPLACE INTO osm_places (
                        node_id,
                        name,
                        place,
                        ags,
                        plz,
                        latitude,
                        longitude
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (node_id, name, place, ags, plz, latitude, longitude),
                )
        germany_conn.commit()
    print(f"Filtered data written to osm_places in {germany_db_file}.")


def extract_data(input_file, db_file):
    with sqlite3.connect(db_file) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS places (
                node_id INTEGER PRIMARY KEY,
                name TEXT,
                place TEXT,
                ags TEXT,
                plz TEXT,
                latitude REAL,
                longitude REAL
            )
            """
        )
        conn.commit()
        handler = PlaceHandler(conn)
        handler.apply_file(input_file)
    print(f"Data has been stored in {db_file}.")


if __name__ == "__main__":
    osm_db_file = "osm_node_places.db"
    germany_db_file = "offline_map/germany.db"
    extract_data("germany.osm.pbf", osm_db_file)
    create_filtered_places(osm_db_file, germany_db_file)
