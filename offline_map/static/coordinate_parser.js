import Mgrs, { Utm, LatLon } from './geodesy/mgrs.js';

const mgrsRegex = /^(\d{1,2}[C-HJ-NP-X])\s?([A-HJ-NP-Z]{2})\s?(\d{1}\s?\d{1}|\d{2}\s?\d{2}|\d{3}\s?\d{3}|\d{4}\s?\d{4}|\d{5}\s?\d{5}|)$/i;

const utmRegex = /^(\d{1,2})\s?([NS]?)\s?(\d{1,6})\s?(\d{1,7})$/i;

const latlonRegex = /^([+-]?\d{1,2}(?:[.,]\d+)?)[,;\s]\s?([+-]?\d{1,3}(?:[.,]\d+)?)$/;
const latlonPlusRegex = /^([+-]?\d{1,2}(?:[.,]\d+)?)([+-]\d{1,3}(?:[.,]\d+)?)$/;

function formatMgrsEastingNorthing(easting, northing) {
    let eastingStr = String(Math.floor(easting)).padStart(5, '0').replace(/0+$/, '');
    let northingStr = String(Math.floor(northing)).padStart(5, '0').replace(/0+$/, '');
    const minLength = Math.max(eastingStr.length, northingStr.length);
    eastingStr = eastingStr.padEnd(minLength, '0');
    northingStr = northingStr.padEnd(minLength, '0');
    return [eastingStr, northingStr];
}

function mgrsToString(mgrs, eastingStr, northingStr) {
    return `${mgrs.zone}${mgrs.band} ${mgrs.e100k}${mgrs.n100k} ${eastingStr} ${northingStr}`.trimEnd();
}

function convertMgrs(gridZoneDesignator, gridSquareId, easting, northing) {
    easting = easting.padEnd(5, '0');
    northing = northing.padEnd(5, '0');
    const mgrs = Mgrs.parse(`${gridZoneDesignator}${gridSquareId}${easting}${northing}`);
    const utm = mgrs.toUtm();
    const latlon = utm.toLatLon();
    const mgrs2 = utm.toMgrs();
    const [eastingStr, northingStr] = formatMgrsEastingNorthing(mgrs2.easting, mgrs2.northing);
    return {
        latitude: Math.round(latlon.lat * 1e6) / 1e6,
        longitude: Math.round(latlon.lon * 1e6) / 1e6,
        mgrs: mgrsToString(mgrs2, eastingStr, northingStr),
        utm: utm.toString(),
    };
}

function convertUtm(zone, hemisphere, easting, northing) {
    const utm = new Utm(parseInt(zone), hemisphere || 'N', parseFloat(easting), parseFloat(northing));
    const latlon = utm.toLatLon();
    const mgrs = utm.toMgrs();
    const [eastingStr, northingStr] = formatMgrsEastingNorthing(mgrs.easting, mgrs.northing);
    return {
        latitude: Math.round(latlon.lat * 1e6) / 1e6,
        longitude: Math.round(latlon.lon * 1e6) / 1e6,
        utm: utm.toString(),
        mgrs: mgrsToString(mgrs, eastingStr, northingStr),
    };
}

export function convertLatlon(latitude, longitude) {
    const latlon = new LatLon(parseFloat(latitude), parseFloat(longitude));
    const utm = latlon.toUtm();
    const mgrs = utm.toMgrs();
    const [eastingStr, northingStr] = formatMgrsEastingNorthing(mgrs.easting, mgrs.northing);
    return {
        latitude: Math.round(latlon.lat * 1e6) / 1e6,
        longitude: Math.round(latlon.lon * 1e6) / 1e6,
        utm: utm.toString(),
        mgrs: mgrsToString(mgrs, eastingStr, northingStr),
    };
}

export function parseCoordinate(coordinate) {
    coordinate = coordinate.toUpperCase().trim();

    const mgrsMatch = mgrsRegex.exec(coordinate);
    if (mgrsMatch) {
        const eastingNorthing = mgrsMatch[3].replace(/\s/g, '');
        const length = Math.floor(eastingNorthing.length / 2);
        try {
            return convertMgrs(mgrsMatch[1], mgrsMatch[2],
                eastingNorthing.slice(0, length),
                eastingNorthing.slice(length));
        } catch (e) {
            console.error('MGRS error:', e);
            return null;
        }
    }

    const utmMatch = utmRegex.exec(coordinate);
    if (utmMatch) {
        try {
            return convertUtm(utmMatch[1], utmMatch[2], utmMatch[3], utmMatch[4]);
        } catch (e) {
            console.error('UTM error:', e);
            return null;
        }
    }

    const latlonMatch = latlonRegex.exec(coordinate) || latlonPlusRegex.exec(coordinate);
    if (latlonMatch) {
        try {
            return convertLatlon(
                latlonMatch[1].replace(',', '.'),
                latlonMatch[2].replace(',', '.'));
        } catch (e) {
            console.error('LatLon error:', e);
            return null;
        }
    }

    return null;
}
