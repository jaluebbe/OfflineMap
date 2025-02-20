from fastapi import APIRouter, HTTPException, Query
from coordinate_parser import (
    convert_latlong,
    convert_utm,
    convert_mgrs,
    parse_coordinate,
)

router = APIRouter()


@router.get("/api/convert_lat_lon")
async def convert_lat_lon_endpoint(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    return convert_latlong(latitude, longitude)


@router.get("/api/convert_utm")
async def convert_utm_endpoint(
    zone: int = Query(..., ge=1, le=60),
    hemisphere: str = Query(..., regex="^[NS]$"),
    easting: float = Query(...),
    northing: float = Query(...),
):
    return convert_utm(zone, hemisphere, easting, northing)


@router.get("/api/convert_mgrs")
async def convert_mgrs_endpoint(
    grid_zone_designator: str = Query(..., regex=r"^\d{1,2}[C-HJ-NP-X]$"),
    grid_square_id: str = Query(..., regex="^[A-HJ-NP-Z]{2}$"),
    easting: float | None = Query(None),
    northing: float | None = Query(None),
):
    return convert_mgrs(grid_zone_designator, grid_square_id, easting, northing)


@router.get("/api/parse_coordinate")
async def parse_coordinate_endpoint(coordinate: str = Query(...)):
    result = parse_coordinate(coordinate)
    if result is None:
        raise HTTPException(status_code=400, detail="Cannot parse coordinate.")
    return result
