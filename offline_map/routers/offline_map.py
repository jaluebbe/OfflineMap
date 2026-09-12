import sqlite3
import json
import threading
from fastapi import APIRouter, HTTPException, Request, Response
from pathlib import Path

router = APIRouter(tags=["offline_map"])

osm_path = Path("../osm")
overlays_path = Path("../overlays")
natural_earth_vector_path = Path("natural_earth_vector.mbtiles")
natural_earth_shaded_relief_path = Path("natural_earth_2_shaded_relief.mbtiles")
planet_path = Path("..") / "planet_fallback.mbtiles"

raster_sources = {
    "natural_earth_2_shaded_relief": natural_earth_shaded_relief_path,
    "bluemarble": Path("..") / "bluemarble.mbtiles",
    "gebco": Path("..") / "gebco_z0-9.mbtiles",
    "landcover": Path("..") / "landcover.mbtiles",
}

# Persistent read-only connections, one per file, reused across requests.
# A single sqlite3.Connection isn't safe for concurrent queries from
# multiple threads (FastAPI's thread pool can interleave them), which
# caused sporadic spurious 404s for tiles that clearly exist. Fixed with
# one lock per connection, held for the whole query.
_db_connections: dict[Path, sqlite3.Connection] = {}
_db_locks: dict[Path, threading.Lock] = {}
_creation_lock = threading.Lock()


def get_db_connection(db_file_name: Path) -> sqlite3.Connection:
    if db_file_name not in _db_connections:
        with _creation_lock:
            # Re-check: another thread may have created it while we waited.
            if db_file_name not in _db_connections:
                if not db_file_name.is_file():
                    raise HTTPException(
                        status_code=404,
                        detail=f"File '{db_file_name}' not found.",
                    )
                conn = sqlite3.connect(
                    f"file:{db_file_name}?mode=ro",
                    uri=True,
                    check_same_thread=False,
                )
                # 8 MB page cache per connection; no mmap to keep VSZ low
                conn.execute("PRAGMA cache_size = -8192")
                conn.execute("PRAGMA mmap_size = 0")
                conn.execute("PRAGMA temp_store = MEMORY")
                _db_connections[db_file_name] = conn
                _db_locks[db_file_name] = threading.Lock()
    return _db_connections[db_file_name]


def get_db_lock(db_file_name: Path) -> threading.Lock:
    # Ensure the connection (and its lock) exists first.
    get_db_connection(db_file_name)
    return _db_locks[db_file_name]


def fetch_tile_data(db_file_name: Path, zoom_level, tile_column, tile_row):
    conn = get_db_connection(db_file_name)
    with get_db_lock(db_file_name):
        cursor = conn.execute(
            "SELECT tile_data FROM tiles"
            " WHERE zoom_level = ? and tile_column = ? and tile_row = ?",
            (zoom_level, tile_column, tile_row),
        )
        return cursor.fetchone()


def get_mbtiles_maxzoom(path: Path) -> int | None:
    if not path.is_file():
        return None
    conn = get_db_connection(path)
    with get_db_lock(path):
        row = conn.execute(
            "SELECT value FROM metadata WHERE name = 'maxzoom'"
        ).fetchone()
    return int(row[0]) if row else None


def _base_url(request: Request) -> str:
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    port_suffix = f":{request.url.port}" if request.url.port else ""
    return f"{scheme}://{request.url.hostname}{port_suffix}"


planet_max_zoom = get_mbtiles_maxzoom(planet_path)


@router.get("/api/vector/regions")
def list_vector_regions():
    mbtiles_files = sorted(
        osm_path.glob("*.mbtiles"),
        key=lambda f: f.stat().st_size,
        reverse=True,
    )
    return [
        file.stem for file in mbtiles_files if file.stem != planet_path.stem
    ]


@router.get("/api/vector/metadata/{region}.json")
def get_vector_metadata(region: str, request: Request):
    db_file_name = osm_path / f"{region}.mbtiles"
    db_connection = get_db_connection(db_file_name)
    with get_db_lock(db_file_name):
        cursor = db_connection.execute("SELECT * FROM metadata")
        result = cursor.fetchall()
    if not result:
        raise HTTPException(status_code=404, detail="Metadata not found.")
    base = _base_url(request)
    metadata = {
        "tilejson": "2.0.0",
        "scheme": "xyz",
        "tiles": [f"{base}/api/vector/tiles/{region}/{{z}}/{{x}}/{{y}}.pbf"],
    }
    for key, value in result:
        if key == "json":
            metadata.update(json.loads(value))
        elif key in ("minzoom", "maxzoom"):
            metadata[key] = int(value)
        elif key in ("center", "bounds"):
            continue
        else:
            metadata[key] = value
    return metadata


@router.get("/api/vector/tiles/{region}/{zoom_level}/{x}/{y}.pbf")
def get_vector_tiles(region: str, zoom_level: int, x: int, y: int):
    tile_column = x
    tile_row = 2**zoom_level - 1 - y
    db_file_name = osm_path / f"{region}.mbtiles"
    result = None

    if planet_max_zoom is not None and zoom_level <= planet_max_zoom:
        result = fetch_tile_data(
            planet_path,
            zoom_level,
            tile_column,
            tile_row,
        )

    if result is None:
        result = fetch_tile_data(
            db_file_name,
            zoom_level,
            tile_column,
            tile_row,
        )

    if result is None and zoom_level <= 7:
        result = fetch_tile_data(
            natural_earth_vector_path,
            zoom_level,
            tile_column,
            tile_row,
        )

    if result is None:
        raise HTTPException(status_code=404, detail="Tile not found.")
    return Response(
        content=result[0],
        media_type="application/octet-stream",
        headers={"Content-Encoding": "gzip"},
    )


@router.get("/api/vector/style/{region}/{style_name}.json")
def get_vector_style(region: str, style_name: str, request: Request):
    style_file_name = f"{style_name}_style.json"
    if not Path(style_file_name).is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Style '{style_name}' not known.",
        )
    with open(style_file_name) as f:
        style = json.load(f)
    base = _base_url(request)
    vector_source_key = (
        "openmaptiles"
        if "openmaptiles" in style["sources"]
        else next(
            (
                k
                for k, v in style["sources"].items()
                if v.get("type") == "vector" and "url" in v
            ),
            None,
        )
    )
    if vector_source_key:
        style["sources"][vector_source_key][
            "url"
        ] = f"{base}/api/vector/metadata/{region}.json"
    style["glyphs"] = f"{base}/fonts/{{fontstack}}/{{range}}.pbf"
    if style.get("sprite") is not None:
        style["sprite"] = f"{base}/static/sprites/{style_name}"
    return style


@router.api_route(
    "/api/raster/{source}/{zoom_level}/{x}/{y}.webp",
    methods=["GET", "HEAD"],
)
def get_raster_tile(source: str, zoom_level: int, x: int, y: int):
    if source not in raster_sources:
        raise HTTPException(
            status_code=404, detail=f"Raster source '{source}' not known."
        )
    path = raster_sources[source]
    tile_column = x
    tile_row = 2**zoom_level - 1 - y
    result = fetch_tile_data(
        path,
        zoom_level,
        tile_column,
        tile_row,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Tile not found.")
    return Response(content=result[0], media_type="image/webp")


@router.get("/api/vector/overlays")
def list_vector_overlays():
    if not overlays_path.exists():
        return []
    mbtiles_files = sorted(
        overlays_path.glob("*.mbtiles"),
        key=lambda f: f.stat().st_size,
        reverse=True,
    )
    return [file.stem for file in mbtiles_files]


@router.get("/api/vector/overlay/metadata/{overlay}.json")
def get_overlay_metadata(overlay: str, request: Request):
    db_file_name = overlays_path / f"{overlay}.mbtiles"
    db_connection = get_db_connection(db_file_name)
    with get_db_lock(db_file_name):
        cursor = db_connection.execute("SELECT * FROM metadata")
        result = cursor.fetchall()
    if not result:
        raise HTTPException(status_code=404, detail="Metadata not found.")
    base = _base_url(request)
    metadata = {
        "tilejson": "2.0.0",
        "scheme": "xyz",
        "tiles": [
            f"{base}/api/vector/overlay/tiles/{overlay}/{{z}}/{{x}}/{{y}}.pbf"
        ],
    }
    for key, value in result:
        if key == "json":
            metadata.update(json.loads(value))
        elif key in ("minzoom", "maxzoom"):
            metadata[key] = int(value)
        elif key in ("center", "bounds"):
            continue
        else:
            metadata[key] = value
    return metadata


@router.get("/api/vector/overlay/tiles/{overlay}/{zoom_level}/{x}/{y}.pbf")
def get_overlay_tiles(overlay: str, zoom_level: int, x: int, y: int):
    tile_column = x
    tile_row = 2**zoom_level - 1 - y
    db_file_name = overlays_path / f"{overlay}.mbtiles"
    result = fetch_tile_data(
        db_file_name, zoom_level, tile_column, tile_row
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Tile not found.")
    return Response(
        content=result[0],
        media_type="application/octet-stream",
        headers={"Content-Encoding": "gzip"},
    )


@router.get("/api/vector/overlay/style/{overlay}/{style_name}.json")
def get_overlay_style(overlay: str, style_name: str, request: Request):
    style_file_name = f"{style_name}_style.json"
    if not Path(style_file_name).is_file():
        raise HTTPException(
            status_code=404, detail=f"Style '{style_name}' not known."
        )
    with open(style_file_name) as f:
        raw = f.read()
    base = _base_url(request)
    overlay_metadata_url = f"{base}/api/vector/overlay/metadata/{overlay}.json"
    raw = raw.replace(
        "/api/vector/overlay/metadata/__OVERLAY__/.json",
        overlay_metadata_url,
    )
    style = json.loads(raw)
    style["glyphs"] = f"{base}/fonts/{{fontstack}}/{{range}}.pbf"
    if style.get("sprite") is not None:
        for entry in style["sprite"]:
            if entry["url"].startswith("/"):
                entry["url"] = base + entry["url"]
    return style
