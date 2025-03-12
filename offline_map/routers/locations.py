from fastapi import APIRouter, HTTPException, Query
from post_code_database import get_plz_from_lat_lon, get_features_for_plz
from community_database import (
    get_ags_from_lat_lon,
    get_ags_metadata,
    get_state_ags,
    get_district_ags,
    get_community_ags,
    query_community,
    query_location,
    query_distinct_location,
    query_places,
    get_features_for_ags,
)
from street_database import query_streets

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


@router.get("/api/get_features_for_ags")
async def get_features_for_ags_endpoint(
    ags: str = Query(..., min_length=2, max_length=8, regex="^\d{2,8}$"),
    include_metadata: bool = True,
):
    features = get_features_for_ags(ags)
    if include_metadata:
        for result in features:
            ags_metadata = get_ags_metadata(result["properties"].get("ags"))
            if ags_metadata:
                result["properties"].update(ags_metadata)
    return features


@router.get("/api/get_features_for_plz")
async def get_features_for_plz_endpoint(
    plz: str = Query(..., min_length=2, max_length=5, regex="^\d{2,5}$"),
):
    return get_features_for_plz(plz)


@router.get("/api/get_ags_metadata")
async def get_ags_metadata_endpoint(
    ags: str = Query(..., min_length=2, max_length=8),
):
    ags_metadata = get_ags_metadata(ags)
    if ags_metadata is None:
        raise HTTPException(status_code=404, detail="Metadata not found.")
    return ags_metadata


@router.get("/api/get_state_ags")
async def get_state_ags_endpoint():
    return get_state_ags()


@router.get("/api/get_district_ags")
async def get_district_ags_endpoint(
    ags: str = Query("", max_length=8, regex="^\d*$")
):
    return get_district_ags(ags)


@router.get("/api/get_community_ags")
async def get_community_ags_endpoint(
    ags: str = Query("", max_length=8, regex="^\d*$")
):
    return get_community_ags(ags)


@router.get("/api/query_community")
async def query_community_endpoint(
    search_term: str = Query(..., min_length=1),
    case_insensitive: bool = False,
    ags: str = Query("", max_length=8, regex="^\d*$"),
):
    return query_community(search_term, case_insensitive, ags)


@router.get("/api/query_location")
async def query_location_endpoint(
    search_term: str = Query(..., min_length=1),
    ags: str = Query("", max_length=8, regex="^\d*$"),
    plz: str = Query("", max_length=5, regex="^\d*$"),
    case_insensitive: bool = False,
    distinct: bool = False,
):
    if distinct:
        return query_distinct_location(
            search_term, case_insensitive, ags, plz
        )
    else:
        return query_location(search_term, case_insensitive, ags, plz)


@router.get("/api/query_places")
async def query_places_endpoint(
    search_term: str = Query(..., min_length=1),
    ags: str = Query("", max_length=8, regex="^\d*$"),
    plz: str = Query("", max_length=5, regex="^\d*$"),
    case_insensitive: bool = False,
    include_metadata: bool = False,
):
    results = query_places(search_term, case_insensitive, ags, plz)
    if include_metadata:
        for result in results:
            ags_metadata = get_ags_metadata(result.get("ags"))
            if ags_metadata:
                result.update(ags_metadata)
    return results


@router.get("/api/query_streets")
async def query_streets_endpoint(
    search_term: str = Query(..., min_length=1),
    ags: str = Query("", max_length=8, regex="^\d*$"),
    plz: str = Query("", max_length=5, regex="^\d*$"),
    case_insensitive: bool = False,
    include_metadata: bool = False,
):
    results = query_streets(search_term, case_insensitive, ags, plz)
    if include_metadata:
        for result in results:
            ags_metadata = get_ags_metadata(result.get("ags"))
            if ags_metadata:
                result.update(ags_metadata)
    return results
