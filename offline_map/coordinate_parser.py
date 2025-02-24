import re
from pygeodesy.ellipsoidalVincenty import LatLon
from pygeodesy import Utm, Mgrs

mgrs_regex = re.compile(
    r"^(?P<grid_zone_designator>\d{1,2}[C-HJ-NP-X])\s*"
    r"(?P<grid_square_id>[A-HJ-NP-Z]{2})\s*"
    r"(?P<easting>\d{0,5})\s*"
    r"(?P<northing>\d{0,5})$"
)

utm_regex = re.compile(
    r"^(?P<zone>\d{1,2})\s*"
    r"(?P<hemisphere>[NS])\s*"
    r"(?P<easting>\d{1,6})\s*"
    r"(?P<northing>\d{1,7})$"
)

latlong_regex = re.compile(
    r"^(?P<latitude>[+-]?\d{1,2}(?:[\.,]\d+)?)\s*"
    r"[,;\s]?\s*"
    r"(?P<longitude>[+-]?\d{1,3}(?:[\.,]\d+)?)$"
)


def _format_mgrs_easting_northing(
    easting: int | float | str, northing: int | float | str
) -> tuple[str, str]:
    easting_int = int(easting)
    northing_int = int(northing)
    max_length = len(str(max(easting_int, northing_int)))
    easting_str = f"{easting_int:0{max_length}d}"
    northing_str = f"{northing_int:0{max_length}d}"
    return easting_str, northing_str


def convert_mgrs(
    grid_zone_designator: str,
    grid_square_id: str,
    easting: int | float | str | None,
    northing: int | float | str | None,
) -> dict:
    _mgrs = Mgrs(
        grid_zone_designator,
        grid_square_id,
        easting or 0,
        northing or 0,
    )
    easting_str, northing_str = _format_mgrs_easting_northing(
        _mgrs.easting, _mgrs.northing
    )
    _latlon = _mgrs.toLatLon()
    return {
        "latitude": round(_latlon.lat, 6),
        "longitude": round(_latlon.lon, 6),
        "mgrs": f"{_mgrs.zoneB} {_mgrs.digraph} {easting_str} {northing_str}",
        "utm": _mgrs.toUtm().toStr(),
    }


def convert_utm(
    zone: int | str,
    hemisphere: str,
    easting: int | float | str,
    northing: int | float | str,
) -> dict:
    _utm = Utm(zone, hemisphere, easting, northing)
    _latlon = _utm.toLatLon()
    _mgrs = _utm.toMgrs()
    _mgrs_easting, _mgrs_northing = _format_mgrs_easting_northing(
        _mgrs.easting, _mgrs.northing
    )
    return {
        "latitude": round(_latlon.lat, 6),
        "longitude": round(_latlon.lon, 6),
        "utm": _utm.toStr(),
        "mgrs": f"{_mgrs.zoneB} {_mgrs.digraph} {_mgrs_easting} {_mgrs_northing}",
    }


def convert_latlong(latitude: float | str, longitude: float | str) -> dict:
    _latlon = LatLon(latitude, longitude)
    _utm = _latlon.toUtm()
    _mgrs = _latlon.toMgrs()
    _mgrs_easting, _mgrs_northing = _format_mgrs_easting_northing(
        _mgrs.easting, _mgrs.northing
    )
    return {
        "latitude": round(_latlon.lat, 6),
        "longitude": round(_latlon.lon, 6),
        "utm": _utm.toStr(),
        "mgrs": f"{_mgrs.zoneB} {_mgrs.digraph} {_mgrs_easting} {_mgrs_northing}",
    }


def parse_coordinate(coordinate: str) -> dict | None:
    coordinate = coordinate.upper()
    mgrs_match = mgrs_regex.match(coordinate)
    if mgrs_match:
        return convert_mgrs(
            mgrs_match.group("grid_zone_designator"),
            mgrs_match.group("grid_square_id"),
            mgrs_match.group("easting"),
            mgrs_match.group("northing"),
        )
    utm_match = utm_regex.match(coordinate)
    if utm_match:
        return convert_utm(
            utm_match.group("zone"),
            utm_match.group("hemisphere"),
            utm_match.group("easting"),
            utm_match.group("northing"),
        )
    latlong_match = latlong_regex.match(coordinate)
    if latlong_match:
        return convert_latlong(
            latlong_match.group("latitude").replace(",", "."),
            latlong_match.group("longitude").replace(",", "."),
        )


if __name__ == "__main__":
    test_cases = [
        "32U LB",
        "32U LB 2 0",
        "32U LB 23 05",
        "32U LB 230 052",
        "32U LB 2301 0526",
        "32U LB 23015 05269",
        "32U lb 23015 05269",
        "32ULB2301505269",
        "32uLB2301505269",
        "32U LB 2301 0526",
        "32U LB2301505269",
        "32 N 323015 5605270",
        "32 N 300000 5600000",
        "32 N 323015 5600000",
        "32 N 300000 5605270",
        "32N3230155605270",
        "32 N323015 5605270",
        "32N 3230155605270",
        "50.5725, 6.5005",
        "50.5725, 6.500498",
        "50.572502, 6.5005",
        "50.572502, 6.500498",
        "50.5725,6.5005",
        "50.5725 6.5005",
        "50.5725,+6.5005",
        "50.5725 +6.5005",
        "50.5725+6.5005",
        "+50.5725+6.5005",
        "50.5725, -6.5005",
        "-50.5725, 6.5005",
    ]
    for test in test_cases:
        print(parse_coordinate(test))
