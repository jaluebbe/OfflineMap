from fastapi import APIRouter, HTTPException, Query
from post_code_database import get_plz_from_lat_lon
from community_database import get_ags_from_lat_lon, get_ags_metadata

router = APIRouter(tags=["locations"])


@router.get("/api/get_plz_from_lat_lon")
async def get_plz_from_lat_lon_endpoint(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    plz = get_plz_from_lat_lon(latitude, longitude)
    if plz is None:
        raise HTTPException(status_code=404, detail="PLZ not found.")
    return plz


@router.get("/api/get_ags_from_lat_lon")
async def get_ags_from_lat_lon_endpoint(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
):
    ags = get_ags_from_lat_lon(latitude, longitude)
    if ags is None:
        raise HTTPException(status_code=404, detail="Community not found.")
    return ags


@router.get("/api/get_ags_metadata")
async def get_ags_metadata_endpoint(
    ags: str = Query(..., min_length=2, max_length=8),
):
    ags_metadata = get_ags_metadata(ags)
    if ags_metadata is None:
        raise HTTPException(status_code=404, detail="Metadata not found.")
    return ags_metadata
