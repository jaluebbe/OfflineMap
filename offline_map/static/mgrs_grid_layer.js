import { Utm, LatLon } from './geodesy/mgrs.js';

/**
 * MGRSGridLayer - Leaflet overlay drawing an MGRS/UTMREF grid.
 * Grid lines follow UTM meter boundaries; labels use MGRS
 * notation (100km square IDs, truncated easting/northing digits).
 * Uses the same geodesy classes as coordinate_parser.js.
 */
export const MGRSGridLayer = L.Layer.extend({
  options: {
    color: '#a0522d',
    weight: 0.75,
    opacity: 0.55,
    labelClass: 'mgrs-grid-label',
    squareLabelClass: 'mgrs-grid-square-label',
    cornerLabelClass: 'mgrs-grid-corner-label',
    cornerLabelPosition: 'topleft',
    // keeps labels clear of container edges and overlapping controls
    labelMargin: { x: 70, y: 60 },
    // offsets a label above (northing) or right (easting) of its line
    lineGap: 8,
    // candidate grid intervals in meters, largest to smallest
    intervals: [100000, 10000, 1000, 100, 10],
    // preferred on-screen cell size (px); closest interval wins
    targetCellPx: 120,
    // below this cell size even the coarsest interval is skipped
    minCellPx: 20,
  },

  onAdd: function (map) {
    this._map = map;
    this._group = L.layerGroup().addTo(map);

    this._cornerControl = L.control({ position: this.options.cornerLabelPosition });
    this._cornerControl.onAdd = () => {
      this._cornerDiv = L.DomUtil.create('div', this.options.cornerLabelClass);
      Object.assign(this._cornerDiv.style, {
        background: 'rgba(255, 255, 255, 0.85)',
        padding: '2px 6px',
        fontFamily: 'monospace',
        fontSize: '13px',
        fontWeight: 'bold',
        borderRadius: '3px',
        boxShadow: '0 0 3px rgba(0, 0, 0, 0.4)',
      });
      return this._cornerDiv;
    };
    this._cornerControl.addTo(map);

    map.on('moveend zoomend', this._redraw, this);
    this._redraw();
  },

  onRemove: function (map) {
    map.off('moveend zoomend', this._redraw, this);
    this._group.remove();
    this._cornerControl.remove();
  },

  // Web Mercator ground resolution (m/px) at a latitude and zoom.
  _metersPerPixel: function (lat, zoom) {
    return (156543.03392804097 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  },

  // Candidate interval closest to targetCellPx on screen, or null
  // if even the coarsest one would render below minCellPx.
  _currentInterval: function (lat, zoom) {
    const metersPerPixel = this._metersPerPixel(lat, zoom);
    const { intervals, targetCellPx, minCellPx } = this.options;

    let best = null;
    let bestScore = Infinity;
    for (const interval of intervals) {
      const cellPx = interval / metersPerPixel;
      const score = Math.abs(Math.log(cellPx / targetCellPx));
      if (score < bestScore) {
        bestScore = score;
        best = interval;
      }
    }
    return best / metersPerPixel >= minCellPx ? best : null;
  },

  _redraw: function () {
    this._group.clearLayers();

    const map = this._map;
    const bounds = map.getBounds();
    const center = bounds.getCenter();
    const centerUtm = new LatLon(center.lat, center.lng).toUtm();
    const zoneNumber = centerUtm.zone;
    const hemisphere = centerUtm.hemisphere;
    this._cornerDiv.textContent = this._squareId(centerUtm.toMgrs());

    const interval = this._currentInterval(center.lat, map.getZoom());
    if (interval === null) return;

    // Project corners into the center's UTM zone so the grid
    // stays consistent even near a zone boundary. At extreme
    // zoom-out this projection can fall outside the valid UTM
    // easting range and throw - skip the grid in that case.
    let corners;
    try {
      corners = [
        bounds.getNorthWest(),
        bounds.getNorthEast(),
        bounds.getSouthWest(),
        bounds.getSouthEast(),
      ].map((ll) => new LatLon(ll.lat, ll.lng).toUtm(zoneNumber));
    } catch (e) {
      return;
    }

    const eastings = corners.map((p) => p.easting);
    const northings = corners.map((p) => p.northing);
    const minE = Math.min(...eastings);
    const maxE = Math.max(...eastings);
    const minN = Math.min(...northings);
    const maxN = Math.max(...northings);

    const toLatLng = (easting, northing) => {
      const utm = new Utm(zoneNumber, hemisphere, easting, northing);
      const ll = utm.toLatLon();
      return [ll.lat, ll.lon];
    };

    const startE = Math.floor(minE / interval) * interval;
    const startN = Math.floor(minN / interval) * interval;

    // At 100km, per-line labels aren't useful - show a square ID
    // box per cell instead (see _addSquareLabels).
    const showSquareLabels = interval >= 100000;

    for (let e = startE, prevELetter = null; e <= maxE; e += interval) {
      const line = [toLatLng(e, minN), toLatLng(e, maxN)];
      let label = null;
      if (!showSquareLabels) {
        const { digitStr, letter } = this._digitLabel(e, interval, zoneNumber, hemisphere, minN, 'E');
        label = letter === prevELetter ? digitStr : `${letter}${digitStr}`;
        prevELetter = letter;
      }
      const labelAt = this._clampAxis(line[0], 'y', { x: this.options.lineGap });
      this._addLine(line, label, labelAt, 'E');
    }

    for (let n = startN, prevNLetter = null; n <= maxN; n += interval) {
      const line = [toLatLng(minE, n), toLatLng(maxE, n)];
      let label = null;
      if (!showSquareLabels) {
        const { digitStr, letter } = this._digitLabel(minE, interval, zoneNumber, hemisphere, n, 'N');
        label = letter === prevNLetter ? digitStr : `${letter}${digitStr}`;
        prevNLetter = letter;
      }
      const labelAt = this._clampAxis(line[0], 'x', { y: -this.options.lineGap });
      this._addLine(line, label, labelAt, 'N');
    }

    if (showSquareLabels) {
      const centerZoneBand = `${centerUtm.toMgrs().zone}${centerUtm.toMgrs().band}`;
      this._addSquareLabels(zoneNumber, hemisphere, startE, maxE, startN, maxN, interval, centerZoneBand);
    }
  },

  // Centered two-letter square ID per visible 100km cell, using
  // each cell's true zone/band so labels stay correct across a
  // zone or latitude band boundary (flagged with a full prefix).
  _addSquareLabels: function (zone, hemisphere, startE, maxE, startN, maxN, interval, centerZoneBand) {
    for (let e = startE; e < maxE; e += interval) {
      for (let n = startN; n < maxN; n += interval) {
        const cellUtm = new Utm(zone, hemisphere, e + interval / 2, n + interval / 2);
        const ll = cellUtm.toLatLon();
        const mgrs = new LatLon(ll.lat, ll.lon).toUtm().toMgrs();
        const zoneBand = `${mgrs.zone}${mgrs.band}`;
        const label = zoneBand === centerZoneBand
          ? `${mgrs.e100k}${mgrs.n100k}`
          : `${zoneBand} ${mgrs.e100k}${mgrs.n100k}`;

        L.marker([ll.lat, ll.lon], {
          icon: L.divIcon({
            className: this.options.squareLabelClass,
            html: label,
            iconSize: null,
          }),
          interactive: false,
        }).addTo(this._group);
      }
    }
  },

  // Clamps one axis into view (edge safety), leaves the other at
  // its natural line position, then applies an optional pixel
  // nudge to offset the label to one side of its line.
  _clampAxis: function (latlng, axis, nudge) {
    const margin = this.options.labelMargin;
    const size = this._map.getSize();
    const point = this._map.latLngToContainerPoint(latlng);
    if (axis === 'x') {
      point.x = Math.min(Math.max(point.x, margin.x), size.x - margin.x);
    } else {
      point.y = Math.min(Math.max(point.y, margin.y), size.y - margin.y);
    }
    if (nudge) {
      point.x += nudge.x || 0;
      point.y += nudge.y || 0;
    }
    return this._map.containerPointToLatLng(point);
  },

  _addLine: function (latlngs, label, labelAt, axis) {
    L.polyline(latlngs, {
      color: this.options.color,
      weight: this.options.weight,
      opacity: this.options.opacity,
      interactive: false,
      // opt out of the global showMeasurements default from
      // leaflet-measure-path (set in leaflet_editor.js)
      showMeasurements: false,
    }).addTo(this._group);

    if (label) {
      const style = axis === 'N' ? 'transform:translateY(-100%);display:inline-block;' : '';
      L.marker(labelAt || latlngs[0], {
        icon: L.divIcon({
          className: this.options.labelClass,
          html: `<span style="${style}">${label}</span>`,
          iconSize: null,
        }),
        interactive: false,
      }).addTo(this._group);
    }
  },

  // "32U NU" style zone + 100km square ID.
  _squareId: function (mgrs) {
    return `${mgrs.zone}${mgrs.band} ${mgrs.e100k}${mgrs.n100k}`;
  },

  // Truncated MGRS digits plus the 100km letter for that axis, so
  // callers can flag a square boundary crossing.
  _digitLabel: function (easting, interval, zone, hemisphere, northing, axis) {
    const utm = new Utm(zone, hemisphere, easting, northing);
    const mgrs = utm.toMgrs();
    const digits = interval >= 10000 ? 1 : interval >= 1000 ? 2 : interval >= 100 ? 3 : 4;
    const value = axis === 'E' ? mgrs.easting : mgrs.northing;
    const digitStr = String(Math.floor(value)).padStart(5, '0').slice(0, digits);
    return { digitStr, letter: axis === 'E' ? mgrs.e100k : mgrs.n100k };
  },
});

export function mgrsGridLayer(options) {
  return new MGRSGridLayer(options);
}
