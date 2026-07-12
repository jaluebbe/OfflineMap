map.createPane('editor');
map.getPane('editor').style.zIndex = 392;

var selectedShape = undefined;

// --- Snapshot history ---------------------------------------------------

const SNAPSHOT_MIN_INTERVAL_MS = 30_000;
const SNAPSHOT_BUDGET_BYTES = 2 * 1024 * 1024;
const SNAPSHOT_STORAGE_KEY = 'editorSnapshots';

let _lastSnapshotTime = 0;
let _lastSnapshotJson = null;

function loadSnapshots() {
    try {
        return JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveSnapshot(geoJsonString) {
    const now = Date.now();
    if (now - _lastSnapshotTime < SNAPSHOT_MIN_INTERVAL_MS) return;
    if (geoJsonString === _lastSnapshotJson) return;

    const parsed = JSON.parse(geoJsonString);

    const snapshots = loadSnapshots();
    if (snapshots.length > 0 && snapshots[snapshots.length - 1].data === geoJsonString) return;
    snapshots.push({
        ts: now,
        count: parsed.features.length,
        data: geoJsonString,
    });

    let serialized;
    do {
        if (snapshots.length === 0) return;
        serialized = JSON.stringify(snapshots);
        if (serialized.length <= SNAPSHOT_BUDGET_BYTES) break;
        snapshots.shift();
    } while (true);

    localStorage.setItem(SNAPSHOT_STORAGE_KEY, serialized);
    _lastSnapshotTime = now;
    _lastSnapshotJson = geoJsonString;
    renderSnapshotList();
}

function formatRelativeTime(ts) {
    const diffMs = Date.now() - ts;
    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffH = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (remMin === 0) return `${diffH} h ago`;
    return `${diffH} h ${remMin} min ago`;
}

function showHistoryWatermark(snap) {
    let el = document.getElementById('history-watermark');
    if (!el) {
        el = document.createElement('div');
        el.id = 'history-watermark';
        document.getElementById('map').appendChild(el);
    }
    const date = new Date(snap.ts);
    const dateStr = date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0') + ' ' +
        String(date.getHours()).padStart(2, '0') + ':' +
        String(date.getMinutes()).padStart(2, '0');
    el.textContent = '\u23f1 ' + dateStr + ' (' + snap.count + ')';
    el.style.display = 'block';
}

function hideHistoryWatermark() {
    const el = document.getElementById('history-watermark');
    if (el) el.style.display = 'none';
}

function restoreSnapshot(index) {
    const snapshots = loadSnapshots();
    const snap = snapshots[index];
    if (!snap) return;
    const currentData = localStorage.getItem('editorLayerData');
    if (currentData && currentData !== _lastSnapshotJson) {
        _lastSnapshotTime = 0;
        saveSnapshot(currentData);
    }
    const geoJSONData = JSON.parse(snap.data);
    editorLayer.clearLayers();
    editorLayer.addData(geoJSONData);
    fitBoundsToLayers();
    // Don't overwrite editorLayerData so a page refresh returns to the latest state.
    _lastSnapshotJson = snap.data;
    _lastSnapshotTime = Date.now();
    const snapshots2 = loadSnapshots();
    if (snap.ts === snapshots2[snapshots2.length - 1].ts) {
        hideHistoryWatermark();
    } else {
        showHistoryWatermark(snap);
    }
}

function exportSnapshot(index) {
    const snapshots = loadSnapshots();
    const snap = snapshots[index];
    if (!snap) return;
    const date = new Date(snap.ts);
    const dateStr = date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0') + '_' +
        String(date.getHours()).padStart(2, '0') + '-' +
        String(date.getMinutes()).padStart(2, '0');
    const fileName = `editor_${dateStr}.json`;
    const pom = document.createElement('a');
    pom.setAttribute('href', 'data:application/geo+json;charset=utf-8,' +
        encodeURIComponent(snap.data));
    pom.setAttribute('download', fileName);
    pom.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    }));
}

function renderSnapshotList() {
    const container = document.getElementById('snapshot-list');
    if (!container) return;
    const snapshots = loadSnapshots();
    if (snapshots.length === 0) {
        container.innerHTML = '<div class="snapshot-empty">No snapshots yet.</div>';
        return;
    }
    container.innerHTML = [...snapshots].reverse().map((snap, i) => {
        const originalIndex = snapshots.length - 1 - i;
        const isLatest = i === 0;
        return `<div class="snapshot-item">
            <span class="snapshot-date${isLatest ? ' snapshot-latest' : ''}"
                  onclick="restoreSnapshot(${originalIndex})">
                ${formatRelativeTime(snap.ts)} (${snap.count})
            </span>
        </div>`;
    }).join('');
}

// Refresh relative timestamps every 30 seconds.
setInterval(renderSnapshotList, 30_000);

// Snapshot periodically even without user interaction, using the live
// layer state to avoid snapshotting a restored historical view.
setInterval(() => {
    const liveJson = JSON.stringify(editorLayer.toGeoJSON());
    if (liveJson === _lastSnapshotJson) return;
    _lastSnapshotTime = 0;
    saveSnapshot(liveJson);
}, 30_000);

// --- End snapshot history -----------------------------------------------

function getDateString() {
    let date = new Date();
    return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + "_" + date.getHours() + "-" + date.getMinutes();
}

function updateEditorTooltip(layer, text) {
    if (text && text.trim() !== '') {
        layer.bindTooltip(text, {
            sticky: true,
            direction: "top",
            offset: [0, -5]
        });
    } else {
        layer.unbindTooltip();
    }
}

function dataChanged() {
    hideHistoryWatermark();
    editorLayer.eachLayer(layer => {
        if (layer.feature && layer.feature.properties) {
            if (layer.options && layer.options.text) {
                layer.feature.properties.markerText = layer.options.text || '';
            }
        }
    });
    const data = editorLayer.toGeoJSON();
    const geoJsonString = JSON.stringify(data);
    localStorage.setItem('editorLayerData', geoJsonString);
    saveSnapshot(geoJsonString);
}

function clickedShape(eo) {
    if (map.pm.globalDrawModeEnabled()) {
        return;
    }
    selectedShape = eo.target;
    const properties = eo.sourceTarget.feature?.properties || {};
    updateInputsFromProperties(properties);
    L.DomEvent.stopPropagation(eo);
}

map.on('click', function(eo) {
    if (selectedShape !== undefined) {
        resetInputsToDefault();
    }
    selectedShape = undefined;
});

function resetInputsToDefault() {
    //    colorInput.value = '#3388ff';
    colorInput.disabled = false;
    fillCheckbox.checked = true;
    fillCheckbox.disabled = false;
    measureCheckbox.checked = false;
    measureCheckbox.disabled = false;
    textInput.value = '';
}

function updateInputsFromProperties(properties) {
    if ('color' in properties) {
        colorInput.value = properties.color;
        colorInput.disabled = false;
    } else {
        colorInput.disabled = true;
    }
    if ('fill' in properties) {
        fillCheckbox.checked = properties.fill;
        fillCheckbox.disabled = false;
    } else {
        fillCheckbox.disabled = true;
    }
    if ('showMeasurements' in properties) {
        measureCheckbox.checked = properties.showMeasurements;
        measureCheckbox.disabled = false;
    } else {
        measureCheckbox.disabled = true;
    }
    if ('text' in properties) {
        textInput.value = properties.text;
    } else {
        textInput.value = '';
    }
}

function updateFeatureProperties() {
    if (!selectedShape || !selectedShape.feature) {
        return;
    }
    const properties = selectedShape.feature.properties || {};
    if (!colorInput.disabled) {
        properties.color = colorInput.value;
    }
    if (!fillCheckbox.disabled) {
        properties.fill = fillCheckbox.checked;
    }
    if (!measureCheckbox.disabled) {
        properties.showMeasurements = measureCheckbox.checked;
    }
    properties.text = textInput.value;
    if (typeof selectedShape.setStyle === 'function') {
        const style = {
            color: properties.color,
            fill: properties.fill ? properties.color : null,
        };
        selectedShape.setStyle(style);
    }
    updateEditorTooltip(selectedShape, properties.text);
    applyMeasurements(selectedShape);
    dataChanged();
}

function loadEditorLayerFromLocalStorage() {
    const storedData = localStorage.getItem('editorLayerData');
    if (storedData) {
        const geoJSONData = JSON.parse(storedData);
        editorLayer.clearLayers();
        editorLayer.addData(geoJSONData);
        setTimeout(() => {
            fitBoundsToLayers();
        }, 100);
    }
}

function applyMeasurements(layer) {
    const properties = layer.feature?.properties || {};
    if (typeof layer.showMeasurements === 'function') {
        if (properties.showMeasurements) {
            layer.showMeasurements();
        } else {
            layer.hideMeasurements();
        }
    }
}

const editorLayer = L.geoJSON([], {
    pane: 'editor',
    pointToLayer: function(feature, latlng) {
        const properties = feature.properties || {};
        if ('radius' in properties) {
            return L.circle(latlng, properties);
        } else if ('fill' in properties || 'color' in properties) {
            return L.circleMarker(latlng, properties);
        } else if ('markerText' in properties) {
            return L.marker(latlng, {
                textMarker: true,
                text: properties.markerText,
            });
        }
        return L.marker(latlng);
    },
    onEachFeature: function(feature, layer) {
        const properties = feature.properties || {};
        layer.options.pmIgnore = !!properties.pmIgnore;
        if (typeof properties.showMeasurements !== 'undefined') {
            layer.options.showMeasurements = properties.showMeasurements;
            applyMeasurements(layer);
        }
        updateEditorTooltip(layer, properties.text);
        layer.on('click', clickedShape);
    },
    style: function(feature) {
        const properties = feature.properties || {};
        const style = {};
        if (L.Browser.mobile) {
            style.weight = 5;
        }
        if (properties.color) {
            style.color = properties.color;
        }
        if (typeof properties.fill !== 'undefined') {
            style.fill = properties.fill;
        }
        return style;
    }
}).addTo(map);
layerControl.addOverlay(editorLayer, "Editor");
map.pm.setGlobalOptions({
    layerGroup: editorLayer,
});

editorLayer.on('add', function() {
    editorLayer.eachLayer(function(layer) {
        applyMeasurements(layer);
        if (typeof layer.eachLayer === 'function') {
            layer.eachLayer(function(subLayer) {
                applyMeasurements(subLayer);
            });
        }
    });
});

function clearField(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
}

function clearEditor() {
    const confirmation = confirm("Do you really want to clear the editor layer?");
    if (confirmation) {
        editorLayer.clearLayers();
        dataChanged();
        const stateSelect = document.getElementById('state-select');
        if (stateSelect) {
            stateSelect.selectedIndex = 0;
            stateSelectionChanged();
        }
        clearField('plz-input');
        if (typeof plzChanged === 'function') plzChanged();
        clearField('place-input');
        clearField('street-input');
        clearField('coordinate-input');
        document.getElementById('coordinate-result').innerHTML = '';
    }
}

function importEditor() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert('You need to select a GeoJSON file.');
        return;
    }
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const jsonData = JSON.parse(event.target.result);
            jsonData.features.forEach(feature => {
                const geometryType = feature.geometry?.type;
                feature.properties = feature.properties || {};
                if (geometryType === 'Point') {
                    if (!('text' in feature.properties)) {
                        feature.properties.text = textInput.value;
                    }
                } else if (geometryType === 'LineString') {
                    if (!('color' in feature.properties)) {
                        feature.properties.color = colorInput.value;
                    }
                    if (!('showMeasurements' in feature.properties)) {
                        feature.properties.showMeasurements = measureCheckbox.checked;
                    }
                } else if (geometryType === 'Polygon') {
                    if (!('color' in feature.properties)) {
                        feature.properties.color = colorInput.value;
                    }
                    if (!('fill' in feature.properties)) {
                        feature.properties.fill = fillCheckbox.checked;
                    }
                    if (!('showMeasurements' in feature.properties)) {
                        feature.properties.showMeasurements = measureCheckbox.checked;
                    }
                }
            });
            editorLayer.addData(jsonData);
            fitBoundsToLayers();
            dataChanged();
            fileInput.value = '';
        } catch (error) {
            console.error('File cannot be imported:', error);
            alert('Cannot import file. Please ensure it is valid GeoJSON.');
        }
    };
    reader.readAsText(file);
}

function exportEditor() {
    const exportName = 'editor';
    let fileName = prompt('Choose file name', exportName + '_' + getDateString() + '.json');
    if (fileName === null || fileName.length == 0) {
        return;
    }
    var pom = document.createElement('a');
    let exportData = JSON.stringify(editorLayer.toGeoJSON());
    pom.setAttribute('href', 'data:application/geo+json;charset=utf-8,' + encodeURIComponent(exportData));
    pom.setAttribute('download', fileName);
    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    pom.dispatchEvent(clickEvent);
}

function toggleMapClick(e) {
    isEditing = e.enabled;
}
const pmEvents = [
    'pm:globaleditmodetoggled',
    'pm:globaldrawmodetoggled',
    'pm:globalrotatemodetoggled',
    'pm:globalcutmodetoggled',
    'pm:globaldragmodetoggled',
    'pm:globalremovalmodetoggled'
];
pmEvents.forEach(event => map.on(event, toggleMapClick));
map.pm.addControls(Object.assign({
    oneBlock: true,
}, window.pmControlOptions || {}));

map.on('pm:create', function(eo) {
    const layer = eo.layer;
    layer.feature = layer.feature || {
        type: 'Feature',
        properties: {}
    };
    const properties = layer.feature.properties;
    if (eo.shape === 'Text') {
        properties.markerText = layer.options.text;
    }
    if (eo.shape !== 'Marker' && eo.shape !== 'Text') {
        properties.color = colorInput.value;
    }
    if (eo.shape !== 'Line' && eo.shape !== 'Text' && eo.shape !== 'Marker') {
        properties.fill = fillCheckbox.checked;
    }
    if (eo.shape !== 'Marker' && eo.shape !== 'CircleMarker' && eo.shape !== 'Text') {
        properties.showMeasurements = measureCheckbox.checked;
    }
    if (eo.shape == 'Circle') {
        properties.radius = layer.getRadius();
    }
    const text = textInput.value;
    if (text) {
        properties.text = text;
        layer.bindTooltip(text, {
            sticky: true,
            direction: "top",
            offset: [0, -5]
        });
    }
    if (typeof layer.setStyle === 'function') {
        const style = {};
        if (properties.color) {
            style.color = properties.color;
        }
        if (typeof properties.fill !== 'undefined') {
            style.fill = properties.fill;
        }
        layer.setStyle(style);
    }
    layer.on('click', clickedShape);
    applyMeasurements(layer);
    dataChanged();
});

function initializeFeature(newLayer, originalLayer) {
    newLayer.feature = newLayer.feature || {
        type: 'Feature',
        properties: {}
    };
    newLayer.feature.properties = {
        ...originalLayer.feature.properties
    };
}

function copyTooltip(originalLayer, newLayer) {
    const tooltipContent = originalLayer.getTooltip()?.getContent();
    updateEditorTooltip(newLayer, tooltipContent);
}

function flattenAndAddMultiPolygon(newLayer) {
    const flattened = turf.flatten(newLayer.feature);
    flattened.features.forEach((polygonFeature) => {
        editorLayer.addData(polygonFeature);
    });
    editorLayer.removeLayer(newLayer);
}

map.on('pm:cut', function(eo) {
    const originalLayer = eo.originalLayer;
    const newLayer = eo.layer;
    if (originalLayer?.feature) {
        initializeFeature(newLayer, originalLayer);
        applyMeasurements(newLayer);
        copyTooltip(originalLayer, newLayer);
        if (newLayer.feature.geometry?.type === 'MultiPolygon') {
            flattenAndAddMultiPolygon(newLayer);
        }
        if (typeof newLayer.eachLayer === 'function') {
            newLayer.eachLayer(function(layer) {
                initializeFeature(layer, originalLayer);
                applyMeasurements(layer);
                copyTooltip(originalLayer, layer);
            });
        }
    }
    dataChanged();
});

map.on('pm:remove', dataChanged);

editorLayer.on('pm:update', dataChanged);

L.Polygon.prototype.options.measurementOptions = {
    ha: true,
};
L.Polyline.prototype.options.showMeasurements = true;

loadEditorLayerFromLocalStorage();
renderSnapshotList();
