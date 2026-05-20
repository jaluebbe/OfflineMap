// Shared compass functionality for all map pages.
// Requires: map (Leaflet), turf, _lastLatlng (or sets it if not defined externally)

var _compassHeading = null;

// gpsCompassLine must be defined by the including page before this script runs.
// It is expected to be a L.polyline instance added to the map.

function updateCompassLine() {
    if (_compassHeading === null || typeof _lastLatlng === 'undefined' || _lastLatlng === null) return;
    if (!map.hasLayer(gpsCompassLine)) return;
    const dest = turf.destination(
        turf.point([_lastLatlng.lng, _lastLatlng.lat]),
        0.05, _compassHeading
    );
    gpsCompassLine.setLatLngs([
        _lastLatlng,
        [dest.geometry.coordinates[1], dest.geometry.coordinates[0]]
    ]);
}

function onDeviceOrientation(e) {
    if (e.absolute && e.alpha !== null) {
        _compassHeading = (360 - e.alpha) % 360;
    } else if (e.webkitCompassHeading !== undefined) {
        _compassHeading = e.webkitCompassHeading;
    }
    updateCompassLine();
    // Update compass display if present (leaflet_gps.js control)
    const compassDiv = document.getElementById('compass-value');
    if (compassDiv && _compassHeading !== null) {
        compassDiv.textContent = _compassHeading.toFixed(0) + '°';
    }
}

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

function removeCompassListeners() {
    window.removeEventListener('deviceorientationabsolute', onDeviceOrientation, true);
    window.removeEventListener('deviceorientation', onDeviceOrientation, true);
}

// iOS: show tap overlay to request permission (must be a user gesture)
function requestCompassWithOverlay() {
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
}
