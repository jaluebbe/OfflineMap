var noSleep = new NoSleep();

var gpsMarker = L.marker([0, 0], {
    zIndexOffset: 1000,
    icon: L.icon({
        iconUrl: '/static/img/level_staff_red.svg',
        shadowUrl: '/static/img/level_staff_shadow.png',
        shadowSize: [46, 66],
        shadowAnchor: [0, 66],
        iconSize: [10, 121],
        iconAnchor: [5, 121],
    })
});
var gpsCircle = L.circle([0, 0], { radius: 0, color: 'blue', weight: 2, fill: false });
var gpsHeadingLine = L.polyline([], { color: 'red', weight: 2 });
var gpsCompassLine = L.polyline([], { color: 'orange', weight: 2 });

var gpsControl = L.control({ position: 'bottomright' });
gpsControl.onAdd = function(map) {
    this._div = L.DomUtil.create('div', 'coordinate-control');
    this._div.innerHTML =
        '<div id="gps-result" style="font-size:12px;display:grid;grid-template-columns:auto auto;grid-gap:5px"></div>' +
        '<div style="display:flex;gap:5px;padding-top:4px">' +
        '<button id="gps-reset-btn" onclick="reconnectGPS()">Reset GPS</button>' +
        '<span id="gps-status" style="font-size:11px;align-self:center;color:gray">connecting...</span>' +
        '</div>';
    L.DomEvent.disableClickPropagation(this._div);
    return this._div;
};
gpsControl.addTo(map);

var _compassHeading = null;
var _lastPosition = null;
var _lastLatlng = null;

function requestCompass() {
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    window.addEventListener('deviceorientationabsolute', onDeviceOrientation, true);
                    window.addEventListener('deviceorientation', onDeviceOrientation, true);
                }
            })
            .catch(console.error);
    } else {
        window.addEventListener('deviceorientationabsolute', onDeviceOrientation, true);
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
    }
}

function updateCompassLine() {
    if (_compassHeading === null || _lastLatlng === null) return;
    if (!map.hasLayer(gpsCompassLine)) return;
    const dest = turf.destination(
        turf.point([_lastLatlng.lng, _lastLatlng.lat]),
        0.05, _compassHeading
    );
    const destLatLng = [dest.geometry.coordinates[1], dest.geometry.coordinates[0]];
    gpsCompassLine.setLatLngs([_lastLatlng, destLatLng]);
}

function onDeviceOrientation(e) {
    if (e.absolute && e.alpha !== null) {
        _compassHeading = (360 - e.alpha) % 360;
    } else if (e.webkitCompassHeading !== undefined) {
        _compassHeading = e.webkitCompassHeading;
    }
    updateCompassLine();
    const resultDiv = document.getElementById('gps-result');
    if (resultDiv && _compassHeading !== null) {
        const compassDiv = resultDiv.querySelector('#compass-value');
        if (compassDiv) compassDiv.textContent = _compassHeading.toFixed(0) + '°';
    }
}

function updateGpsControl(position, speed, heading, accuracy, altitude, altitudeAccuracy) {
    const resultDiv = document.getElementById('gps-result');
    if (!resultDiv) return;
    const rows = [];
    const fields = window.locationPickerFields || ['latlon', 'utm', 'mgrs'];
    if (fields.includes('latlon') && position)
        rows.push(`<div><b>Lat., Lon.</b></div><div>${position.latitude}, ${position.longitude}</div>`);
    if (fields.includes('mgrs') && position)
        rows.push(`<div><b>MGRS</b></div><div>${position.mgrs}</div>`);
    if (speed !== null && speed !== undefined)
        rows.push(`<div><b>Speed</b></div><div>${(speed * 3.6).toFixed(1)} km/h</div>`);
    if (heading !== null && heading !== undefined)
        rows.push(`<div><b>Heading</b></div><div style="color:red">${heading.toFixed(0)}°</div>`);
    rows.push(`<div><b>Compass</b></div><div id="compass-value" style="color:orange">${_compassHeading !== null ? _compassHeading.toFixed(0) + '°' : ''}</div>`);
    if (accuracy !== null && accuracy !== undefined)
        rows.push(`<div><b>Accuracy</b></div><div style="color:blue">±${accuracy.toFixed(0)} m</div>`);
    if (altitude !== null && altitude !== undefined) {
        const altAcc = altitudeAccuracy !== null && altitudeAccuracy !== undefined ? ` ±${altitudeAccuracy.toFixed(0)}` : '';
        rows.push(`<div><b>Altitude</b></div><div>${altitude.toFixed(0)}${altAcc} m</div>`);
    }
    resultDiv.innerHTML = rows.join('');
}

function onLocationFound(e) {
    const latlng = e.latlng.wrap();
    _lastLatlng = latlng;

    gpsMarker.setLatLng(latlng);
    gpsCircle.setLatLng(latlng);
    if (isFinite(e.accuracy)) gpsCircle.setRadius(e.accuracy);

    if (!map.hasLayer(gpsMarker)) {
        gpsMarker.addTo(map);
        gpsCircle.addTo(map);
        gpsHeadingLine.addTo(map);
        gpsCompassLine.addTo(map);
    }

    if (!map.getBounds().pad(-0.1).contains(latlng)) {
        map.setView(latlng, map.getZoom(), { animate: true });
    }

    if (e.heading !== null && e.heading !== undefined && isFinite(e.heading) && e.speed > 0.5) {
        const dest = turf.destination(
            turf.point([latlng.lng, latlng.lat]),
            0.05, e.heading
        );
        const destLatLng = [dest.geometry.coordinates[1], dest.geometry.coordinates[0]];
        gpsHeadingLine.setLatLngs([latlng, destLatLng]);
    } else {
        gpsHeadingLine.setLatLngs([]);
    }

    updateCompassLine();

    if (window.convertLatlon) {
        const position = window.convertLatlon(latlng.lat, latlng.lng);
        _lastPosition = position;
        updateGpsControl(position, e.speed, e.heading, e.accuracy, e.altitude, e.altitudeAccuracy);
    } else {
        updateGpsControl(null, e.speed, e.heading, e.accuracy, e.altitude, e.altitudeAccuracy);

    }
}

function onLocationError(e) {
    const status = document.getElementById('gps-status');
    if (status) status.textContent = 'error: ' + e.message;
}

function connectGPS() {
    map.stopLocate();
    map.locate({ watch: true, enableHighAccuracy: true });
    noSleep.enable();
    document.getElementById('gps-status').textContent = 'connected';
    document.getElementById('gps-status').style.color = 'green';
}

function reconnectGPS() {
    connectGPS();
    requestCompass();
}

map.on('locationfound', onLocationFound);
map.on('locationerror', onLocationError);
map.whenReady(function() {
    connectGPS();
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);' +
            'color:white;font-size:20px;display:flex;align-items:center;' +
            'justify-content:center;z-index:9999;cursor:pointer';
        overlay.textContent = 'Tap to enable compass';
        overlay.addEventListener('click', function() {
            requestCompass();
            overlay.remove();
        });
        document.body.appendChild(overlay);
    } else {
        requestCompass();
    }
});

function fixIOSResize() {
    setTimeout(() => {
        map.invalidateSize({ animate: false });
        if (_lastLatlng) {
            map.setView(_lastLatlng, map.getZoom(), { animate: false });
        }
    }, 250);
}
window.addEventListener("orientationchange", fixIOSResize);
window.addEventListener("resize", fixIOSResize);
