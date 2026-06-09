const minZoom = 0;
const maxZoom = 22;
const map = L.map('map', {
    minZoom: minZoom,
    maxZoom: maxZoom
});
map.attributionControl.addAttribution('<a href="https://github.com/jaluebbe/OfflineMap">Source on GitHub</a>');
// add link to an imprint and a privacy statement if the file is available.
function addPrivacyStatement() {
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', "/static/datenschutz.html");
    xhr.onload = function() {
        if (xhr.status === 200)
            map.attributionControl.addAttribution(
                '<a href="/static/datenschutz.html" target="_blank">Impressum & Datenschutzerkl&auml;rung</a>'
            );
    }
    xhr.send();
}
addPrivacyStatement();

function addOSMVectorLayer(styleName, region, layerLabel) {
    let myLayer = L.maplibreGL({
        style: '/api/vector/style/' + region + '/' + styleName + '.json',
        attribution: '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    layerControl.addBaseLayer(myLayer, layerLabel);
    // make sure to reprint the vector map after being selected.
    map.on('baselayerchange', function(eo) {
        if (eo.name === layerLabel) {
            myLayer._update();
        }
    });
    return myLayer;
};

async function checkRasterLayerAvailable(url, options, label) {
    try {
        const testUrl = url.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0');
        const response = await fetch(testUrl, {
            method: 'HEAD'
        });
        if (response.ok) {
            const layer = L.tileLayer(url, options);
            layerControl.addBaseLayer(layer, label);
            return label;
        }
    } catch (e) {
        console.warn(`Raster layer '${label}' not available:`, e);
    }
    return null;
}

function fitBoundsToLayers() {
    const candidates = [
        typeof streetsLayer !== 'undefined' ? streetsLayer : null,
        typeof placesLayer !== 'undefined' ? placesLayer : null,
        typeof editorLayer !== 'undefined' ? editorLayer : null,
    ];
    const bounds = L.latLngBounds([]);
    candidates.forEach(layer => {
        if (layer && layer.getLayers().length > 0) {
            bounds.extend(layer.getBounds());
        }
    });
    if (bounds.isValid()) {
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
            map.setView(bounds.getCenter(), 16);
        } else {
            map.fitBounds(bounds);
        }
    }
}

L.control.scale({
    'imperial': false
}).addTo(map);
var baseLayers = {};
var other_layers = {};
var layerControl = L.control.layers(baseLayers, other_layers, {
    collapsed: L.Browser.mobile,
    position: 'topright'
}).addTo(map);

let labelsOverlay = null;
let labelsEnabled = false;
let activeBaseLayerName = 'OSM Basic';
const rasterLayerNames = ["GEBCO", "Blue Marble"];

function showLabelsOverlay() {
    if (!labelsOverlay) return;
    if (!map.hasLayer(labelsOverlay)) {
        labelsOverlay.addTo(map);
        labelsOverlay._update();
    }
    setTimeout(() => {
        const container = labelsOverlay.getContainer();
        if (container) container.style.zIndex = 400;
    }, 50);
}

function hideLabelsOverlay() {
    if (labelsOverlay && map.hasLayer(labelsOverlay)) {
        map.removeLayer(labelsOverlay);
    }
}

map.on('baselayerchange', function(e) {
    activeBaseLayerName = e.name;
    if (labelsEnabled && rasterLayerNames.includes(e.name)) {
        showLabelsOverlay();
    } else {
        hideLabelsOverlay();
    }
});

map.on('overlayadd', function(e) {
    if (e.name === 'Labels') {
        labelsEnabled = true;
        if (rasterLayerNames.includes(activeBaseLayerName)) {
            showLabelsOverlay();
        }
    }
});

map.on('overlayremove', function(e) {
    if (e.name === 'Labels') {
        labelsEnabled = false;
        hideLabelsOverlay();
    }
});

const regionsPromise = fetch('/api/vector/regions')
    .then(response => response.json())
    .then(data => {
        if (data.length > 0) {
            const mapRegion = data[0];
            addOSMVectorLayer("osm_basic", mapRegion, "OSM Basic").addTo(map);
            addOSMVectorLayer("osm_bright", mapRegion, "OSM Bright");
            addOSMVectorLayer("osm_liberty", mapRegion, "OSM Liberty");
            addOSMVectorLayer("osm_positron", mapRegion, "OSM Positron");
            map.setView([52.2775, 8.0415], 16);
            return mapRegion;
        } else {
            console.warn('No regions available.');
            return null;
        }
    })
    .catch(error => {
        console.error('Error fetching regions:', error);
        return null;
    });

const rasterPromises = [
    checkRasterLayerAvailable(
        '/api/raster/gebco/{z}/{x}/{y}.webp', {
            maxNativeZoom: 9,
            maxZoom: 22,
            attribution: '&copy; <a href="https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid">GEBCO_2026 Grid</a>'
        },
        'GEBCO'
    ),
    checkRasterLayerAvailable(
        '/api/raster/bluemarble/{z}/{x}/{y}.webp', {
            maxNativeZoom: 8,
            maxZoom: 22,
            attribution: '&copy; <a href="https://github.com/freetiler/nasa-bluemarble">FreeTiler.com | NASA Earth Observatory</a>'
        },
        'Blue Marble'
    ),
];

Promise.all([regionsPromise, ...rasterPromises]).then(([mapRegion, ...rasterResults]) => {
    const availableRasterLayers = rasterResults.filter(Boolean);
    if (mapRegion && availableRasterLayers.length > 0) {
        labelsOverlay = L.maplibreGL({
            style: `/api/vector/style/${mapRegion}/map_labels.json`,
            attribution: '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        });
        layerControl.addOverlay(labelsOverlay, "Labels");
    }
});

function setupAttribution() {
    var attrControl = document.querySelector('.leaflet-control-attribution');
    if (!attrControl || document.getElementById('attr-toggle')) return;
    var attrContent = attrControl.innerHTML;
    attrControl.style.display = 'flex';
    attrControl.style.alignItems = 'center';
    attrControl.innerHTML =
        '<span id="attr-toggle" style="cursor:pointer;padding-right:2px;flex-shrink:0">ℹ️</span>' +
        '<span id="attr-content" style="display:none">' + attrContent + '</span>';
    document.getElementById('attr-toggle').addEventListener('click', function() {
        var content = document.getElementById('attr-content');
        content.style.display = content.style.display === 'none' ? 'inline' : 'none';
    });
}

map.whenReady(function() {
    setupAttribution();
    var observer = new MutationObserver(function() {
        if (!document.getElementById('attr-toggle')) {
            setupAttribution();
        }
    });
    observer.observe(document.querySelector('.leaflet-control-attribution'), {
        childList: true,
        subtree: true,
        characterData: true
    });
});

map.on('baselayerchange', function() {
    setTimeout(setupAttribution, 50);
});

function fixIOSResize() {
    setTimeout(() => {
        map.invalidateSize({
            animate: false
        });
        if (typeof _gpsCenter !== 'undefined' && _gpsCenter) {
            map.setView(_gpsCenter, map.getZoom(), {
                animate: false
            });
        }
    }, 250);
}
window.addEventListener('orientationchange', fixIOSResize);
window.addEventListener('resize', fixIOSResize);
