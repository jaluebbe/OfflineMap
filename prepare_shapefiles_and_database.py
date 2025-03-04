#!offline_map/venv/bin/python
import json
import re
import sqlite3
import csv
from pathlib import Path
import geopandas as gpd


def clip_coordinates(content):
    return re.sub(r"([0-9]+\.[0-9]{5})[0-9]+", r"\1", content)


def calculate_bounding_box(row):
    bounds = row.geometry.bounds
    return [
        round(bounds[0], 5),
        round(bounds[1], 5),
        round(bounds[2], 5),
        round(bounds[3], 5),
    ]


def process_german_post_codes(input_file, output_file):
    gdf = gpd.read_file(input_file)
    gdf = gdf[["plz", "geometry"]]
    geojson = json.loads(gdf.to_json())
    for feature, bbox in zip(
        geojson["features"], gdf.apply(calculate_bounding_box, axis=1)
    ):
        feature["bbox"] = bbox
    geojson_str = json.dumps(geojson, separators=(",", ":"))
    geojson_str_clipped = clip_coordinates(geojson_str)
    with open(output_file, "w") as f:
        f.write(geojson_str_clipped)


def process_german_communities(input_file, output_file, sqlite_file):
    gdf = gpd.read_file(input_file)
    gdf["NBD"] = gdf["NBD"].apply(lambda x: x.lower() == "ja")
    gdf = gdf.to_crs(epsg=4326)
    gdf_shapes = gdf[["AGS", "geometry"]].rename(columns={"AGS": "ags"})
    geojson = json.loads(gdf_shapes.to_json())
    for feature, bbox in zip(
        geojson["features"], gdf_shapes.apply(calculate_bounding_box, axis=1)
    ):
        feature["bbox"] = bbox
    geojson_str = json.dumps(geojson, separators=(",", ":"))
    geojson_str_clipped = clip_coordinates(geojson_str)
    with open(output_file, "w") as f:
        f.write(geojson_str_clipped)
    communities = gdf[["AGS", "BEZ", "NBD", "GEN"]]
    with sqlite3.connect(sqlite_file) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS communities (
                ags TEXT PRIMARY KEY,
                bez TEXT,
                nbd INTEGER,
                gen TEXT
            )
        """
        )
        cursor.executemany(
            """
            INSERT OR REPLACE INTO communities (ags, bez, nbd, gen)
            VALUES (?, ?, ?, ?)
        """,
            communities.values.tolist(),
        )


def process_german_states(input_file, sqlite_file):
    gdf = gpd.read_file(input_file)
    gdf["NBD"] = gdf["NBD"].apply(lambda x: x.lower() == "ja")
    filtered_gdf = gdf[~gdf["GEN"].str.contains("Bodensee")]
    states = filtered_gdf[["AGS", "BEZ", "NBD", "GEN"]].drop_duplicates()
    with sqlite3.connect(sqlite_file) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS states (
                ags TEXT PRIMARY KEY,
                bez TEXT,
                nbd INTEGER,
                gen TEXT
            )
        """
        )
        cursor.executemany(
            """
            INSERT OR REPLACE INTO states (ags, bez, nbd, gen)
            VALUES (?, ?, ?, ?)
        """,
            states.values.tolist(),
        )


def process_german_districts(input_file, sqlite_file):
    gdf = gpd.read_file(input_file)
    gdf["NBD"] = gdf["NBD"].apply(lambda x: x.lower() == "ja")
    districts = gdf[
        [
            "AGS",
            "BEZ",
            "NBD",
            "GEN",
        ]
    ]
    with sqlite3.connect(sqlite_file) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS districts (
                ags TEXT PRIMARY KEY,
                bez TEXT,
                nbd INTEGER,
                gen TEXT
            )
        """
        )
        cursor.executemany(
            """
            INSERT OR REPLACE INTO districts (ags, bez, nbd, gen)
            VALUES (?, ?, ?, ?)
        """,
            districts.values.tolist(),
        )


def create_community_view(sqlite_file):
    with sqlite3.connect(sqlite_file) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE VIEW IF NOT EXISTS community_view AS
            SELECT 
                c.ags AS ags,
                CASE 
                    WHEN c.nbd THEN c.bez
                    ELSE NULL
                END AS community_prefix,
                c.gen AS community,
                CASE 
                    WHEN d.nbd THEN d.bez
                    ELSE NULL
                END AS district_prefix,
                d.gen AS district,
                CASE 
                    WHEN s.nbd THEN s.bez
                    ELSE NULL
                END AS state_prefix,
                s.gen AS state
            FROM 
                communities c
            JOIN 
                districts d ON substr(c.ags, 1, 5) = d.ags
            JOIN 
                states s ON substr(d.ags, 1, 2) = s.ags
        """
        )
        conn.commit()


def create_location_ags_plz_db(csv_file, db_file):
    with sqlite3.connect(db_file) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS location_ags_plz (
                osm_relation_id INTEGER,
                name TEXT,
                ags TEXT,
                plz TEXT,
                PRIMARY KEY (ags, plz)
            )
        """
        )
        with open(csv_file, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = []
            for row in reader:
                osm_id = row["osm_id"]
                name = row["ort"]
                ags = row["ags"]
                plz = row["plz"]
                rows.append((osm_id, name, ags, plz))
            cursor.executemany(
                """
                INSERT OR REPLACE INTO location_ags_plz (osm_relation_id, name, ags, plz)
                VALUES (?, ?, ?, ?)
            """,
                rows,
            )
        conn.commit()


if __name__ == "__main__":
    sqlite_file = "offline_map/germany.db"
    vg5000_path = Path("vg5000")
    communities_input = vg5000_path / "VG5000_GEM.shp"
    communities_output = "offline_map/communities_germany.json"
    if communities_input.exists():
        process_german_communities(
            communities_input, communities_output, sqlite_file
        )
    else:
        print(f"Skip processing {communities_input}.")
    states_input = vg5000_path / "VG5000_LAN.shp"
    if states_input.exists():
        process_german_states(states_input, sqlite_file)
    else:
        print(f"Skip processing {states_input}.")
    districts_input = vg5000_path / "VG5000_KRS.shp"
    if districts_input.exists():
        process_german_districts(districts_input, sqlite_file)
    else:
        print(f"Skip processing {districts_input}.")
    post_codes_input = Path("plz-5stellig.geojson")
    post_codes_output = "offline_map/post_codes_germany.json"
    if post_codes_input.exists():
        process_german_post_codes(post_codes_input, post_codes_output)
    else:
        print(f"Skip processing {post_codes_input}.")
    csv_input = Path("zuordnung_plz_ort.csv")
    if csv_input.exists():
        create_location_ags_plz_db(csv_input, sqlite_file)
    else:
        print(f"Skip processing {csv_input}.")
    create_community_view(sqlite_file)
