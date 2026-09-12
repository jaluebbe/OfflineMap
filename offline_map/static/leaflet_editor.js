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

    try {
        localStorage.setItem(SNAPSHOT_STORAGE_KEY, serialized);
    } catch (error) {
        console.warn('editorSnapshots exceeds localStorage quota; skipping this snapshot.', error);
        return;
    }
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
    try {
        localStorage.setItem('editorLayerData', geoJsonString);
    } catch (error) {
        console.warn('editorLayerData exceeds localStorage quota; layer is shown but will not persist across reloads.', error);
    }
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
    unitDesignationInput.value = '';
    unitStrengthInput.value = '';
    symbolCategoryInput.value = '';
    symbolCategoryInput.disabled = false;
    populateSymbolSelect('');
}

function updateInputsFromProperties(properties) {
    const isPoint = selectedShape?.feature?.geometry?.type === 'Point';
    if (isPoint && 'icon' in properties) {
        const relPath = properties.icon.replace('/static/symbols/', '');
        const category = relPath.split('/')[0];
        symbolCategoryInput.value = category;
        symbolCategoryInput.disabled = false;
        populateSymbolSelect(category);
        symbolInput.value = relPath;
        colorInput.disabled = true;
    } else {
        symbolCategoryInput.value = '';
        symbolCategoryInput.disabled = !isPoint;
        populateSymbolSelect('');
        if ('color' in properties) {
            colorInput.value = properties.color;
            colorInput.disabled = false;
        } else {
            colorInput.disabled = true;
        }
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
    unitDesignationInput.value = properties.unitDesignation || '';
    unitStrengthInput.value = properties.unitStrength || '';
}

function updateFeatureProperties() {
    if (!selectedShape || !selectedShape.feature) {
        return;
    }
    const properties = selectedShape.feature.properties || {};
    const symbolPath = symbolInput.value;
    const hadIcon = 'icon' in properties;
    const wantsIcon = !!symbolPath;
    colorInput.disabled = wantsIcon;

    if (wantsIcon) {
        properties.icon = '/static/symbols/' + symbolPath;
        properties.iconName = symbolNameByPath[symbolPath] || '';
        properties.iconHeight = properties.iconHeight || 48;
        delete properties.color;
        delete properties.fill;
    } else if (hadIcon) {
        delete properties.icon;
        delete properties.iconName;
        delete properties.iconHeight;
        delete properties.iconAnchorX;
        delete properties.iconAnchorY;
    }
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
    properties.unitDesignation = unitDesignationInput.value;
    properties.unitStrength = unitStrengthInput.value;

    if (hadIcon !== wantsIcon) {
        // Icon marker and circle/plain marker are different Leaflet layer
        // classes; switching between them needs a fresh layer, not setStyle.
        recreateSelectedShape(properties);
        return;
    }
    if (wantsIcon && typeof selectedShape.setIcon === 'function') {
        selectedShape.setIcon(buildSvgDivIcon(properties));
    }
    if (typeof selectedShape.setStyle === 'function') {
        const style = {
            color: properties.color,
            fill: properties.fill ? properties.color : null,
        };
        selectedShape.setStyle(style);
    }
    updateEditorTooltip(selectedShape, buildTooltipContent(properties));
    updateShapeLabel(selectedShape);
    applyMeasurements(selectedShape);
    dataChanged();
}

function recreateSelectedShape(properties) {
    const latlng = selectedShape.getLatLng();
    editorLayer.removeLayer(selectedShape);
    editorLayer.addData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [latlng.lng, latlng.lat] },
        properties: properties,
    });
    // The new layer isn't tracked as the current selection; click it again
    // on the map to keep editing it.
    selectedShape = undefined;
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

function buildSvgDivIcon(properties) {
    const height = properties.iconHeight || 27;
    const anchorX = properties.iconAnchorX ?? 0.5;
    const anchorY = properties.iconAnchorY ?? 0.5;
    const labelLines = [];
    const designation = properties.unitDesignation ? properties.unitDesignation.trim() : '';
    const strength = properties.unitStrength ? properties.unitStrength.trim() : '';
    if (designation) labelLines.push(designation);
    if (strength) labelLines.push(strength);
    // Position below the image's actual bottom edge, which depends on
    // where the anchor sits within it (e.g. near the top for arrow tips).
    const labelTop = height * (1 - anchorY);
    const labelHtml = labelLines.length
        ? `<div class="unit-label" style="position:absolute; top:${labelTop}px; left:0; transform: translate(-50%, 0); white-space:nowrap; text-align:center;">${labelLines.join('<br>')}</div>`
        : '';
    return L.divIcon({
        className: 'geojson-svg-icon',
        html: `<img src="${properties.icon}" style="height:${height}px; transform: translate(-${anchorX * 100}%, -${anchorY * 100}%)" />${labelHtml}`,
        iconSize: null,
        iconAnchor: [0, 0],
    });
}

function buildTooltipContent(properties) {
    const text = properties.text ? properties.text.trim() : '';
    if (properties.iconName) {
        return text ? `${properties.iconName}<br>${text}` : properties.iconName;
    }
    return properties.text;
}

// Designation/strength for shapes/lines (which have no single icon to
// attach a label to) render as a small permanent marker at the geometry's
// lowest point instead. Point markers carry their own label in buildSvgDivIcon.
const shapeLabelLayer = L.layerGroup().addTo(map);

function getLabelLatLng(layer) {
    try {
        const point = turf.pointOnFeature(layer.toGeoJSON());
        const [lng, lat] = point.geometry.coordinates;
        return L.latLng(lat, lng);
    } catch (error) {
        console.warn('Could not compute a label point for this feature:', error);
        return null;
    }
}

function updateShapeLabel(layer) {
    if (layer._unitLabelMarker) {
        shapeLabelLayer.removeLayer(layer._unitLabelMarker);
        layer._unitLabelMarker = null;
    }
    if (layer.feature?.geometry?.type === 'Point') return;
    const properties = layer.feature?.properties || {};
    const designation = properties.unitDesignation ? properties.unitDesignation.trim() : '';
    const strength = properties.unitStrength ? properties.unitStrength.trim() : '';
    if (!designation && !strength) return;
    const latlng = getLabelLatLng(layer);
    if (!latlng) return;
    const lines = [designation, strength].filter(Boolean);
    layer._unitLabelMarker = L.marker(latlng, {
        interactive: false,
        pmIgnore: true,
        icon: L.divIcon({
            className: 'geojson-svg-icon',
            html: `<div class="unit-label" style="position:absolute; top:0; left:0; transform: translate(-50%, -50%); white-space:nowrap; text-align:center;">${lines.join('<br>')}</div>`,
            iconSize: null,
            iconAnchor: [0, 0],
        }),
    }).addTo(shapeLabelLayer);
}

const editorLayer = L.geoJSON([], {
    pane: 'editor',
    pointToLayer: function(feature, latlng) {
        const properties = feature.properties || {};
        if (properties.icon) {
            return L.marker(latlng, { icon: buildSvgDivIcon(properties) });
        }
        if ('radius' in properties) {
            return L.circle(latlng, properties);
        } else if ('markerRadius' in properties || 'fill' in properties || 'color' in properties) {
            const circleOptions = Object.assign({}, properties);
            if ('markerRadius' in properties) {
                circleOptions.radius = properties.markerRadius;
            }
            return L.circleMarker(latlng, circleOptions);
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
        updateEditorTooltip(layer, buildTooltipContent(properties));
        updateShapeLabel(layer);
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
        shapeLabelLayer.clearLayers();
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
    const exportData = JSON.stringify(editorLayer.toGeoJSON());
    const blob = new Blob([exportData], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const pom = document.createElement('a');
    pom.href = url;
    pom.download = fileName;
    document.body.appendChild(pom);
    pom.click();
    document.body.removeChild(pom);
    URL.revokeObjectURL(url);
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
        updateShapeLabel(newLayer);
        if (newLayer.feature.geometry?.type === 'MultiPolygon') {
            flattenAndAddMultiPolygon(newLayer);
        }
        if (typeof newLayer.eachLayer === 'function') {
            newLayer.eachLayer(function(layer) {
                initializeFeature(layer, originalLayer);
                applyMeasurements(layer);
                copyTooltip(originalLayer, layer);
                updateShapeLabel(layer);
            });
        }
    }
    dataChanged();
});

map.on('pm:remove', function(eo) {
    if (eo.layer && eo.layer._unitLabelMarker) {
        shapeLabelLayer.removeLayer(eo.layer._unitLabelMarker);
    }
    dataChanged();
});

editorLayer.on('pm:update', function(eo) {
    if (eo.layer) {
        updateShapeLabel(eo.layer);
    }
    dataChanged();
});

L.Polygon.prototype.options.measurementOptions = {
    ha: true,
};
L.Polyline.prototype.options.showMeasurements = true;

let _lastAddedCircleMarkerLatLng = null;

function addCircleMarkerFeature(lat, lng) {
    if (_lastAddedCircleMarkerLatLng &&
        _lastAddedCircleMarkerLatLng.lat === lat &&
        _lastAddedCircleMarkerLatLng.lng === lng) {
        return;
    }
    const symbolPath = symbolInput.value;
    let properties;
    if (symbolPath) {
        properties = {
            icon: '/static/symbols/' + symbolPath,
            iconName: symbolNameByPath[symbolPath] || '',
            iconHeight: 48,
        };
    } else {
        properties = {
            color: colorInput.value,
            fill: fillCheckbox.checked,
        };
    }
    const text = textInput.value;
    if (text) {
        properties.text = text;
    }
    if (unitDesignationInput.value) {
        properties.unitDesignation = unitDesignationInput.value;
    }
    if (unitStrengthInput.value) {
        properties.unitStrength = unitStrengthInput.value;
    }
    editorLayer.addData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: properties,
    });
    dataChanged();
    _lastAddedCircleMarkerLatLng = { lat: lat, lng: lng };
}

function handleCoordinateAddButton() {
    const coordinateInput = document.getElementById('coordinate-input').value.trim();
    if (coordinateInput === '') {
        const latlng = map.hasLayer(myMarker) ? myMarker.getLatLng() : map.getCenter();
        addCircleMarkerFeature(latlng.lat, latlng.lng);
        return;
    }
    const resultDiv = document.getElementById('coordinate-result');
    if (window.parseCoordinate) {
        const data = window.parseCoordinate(coordinateInput);
        if (data) {
            addCircleMarkerFeature(data.latitude, data.longitude);
        } else {
            resultDiv.textContent = "Invalid coordinate";
            resultDiv.style.color = "red";
        }
    } else {
        fetch(`/api/parse_coordinate?coordinate=${encodeURIComponent(coordinateInput)}`)
            .then(handleApiResponse)
            .then(data => addCircleMarkerFeature(data.latitude, data.longitude))
            .catch(error => {
                resultDiv.textContent = error.message;
                resultDiv.style.color = "red";
            });
    }
}

document.getElementById('coordinate-add-button').addEventListener('click', handleCoordinateAddButton);

let symbolManifest = {};
let symbolNameByPath = {};

function populateSymbolSelect(category) {
    symbolInput.innerHTML = '<option value="">Kein Zeichen</option>';
    const symbols = symbolManifest[category] || [];
    for (const symbol of symbols) {
        const option = document.createElement('option');
        option.value = symbol.path;
        option.textContent = symbol.name;
        symbolInput.appendChild(option);
    }
    symbolInput.disabled = symbols.length === 0;
}

function handleSymbolCategoryChange() {
    populateSymbolSelect(symbolCategoryInput.value);
    if (!symbolCategoryInput.value) {
        updateFeatureProperties();
    }
}

fetch('/static/symbols/symbols_manifest.json')
    .then(handleApiResponse)
    .then(manifest => {
        symbolManifest = manifest;
        for (const [category, symbols] of Object.entries(manifest)) {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category.replace(/_/g, ' ');
            symbolCategoryInput.appendChild(option);
            for (const symbol of symbols) {
                symbolNameByPath[symbol.path] = symbol.name;
            }
        }
    })
    .catch(error => console.warn('Could not load symbol manifest:', error));

loadEditorLayerFromLocalStorage();
renderSnapshotList();

const UnitLabelToggleControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const button = L.DomUtil.create('a', '', container);
        button.href = '#';
        button.title = 'Beschriftung ein-/ausblenden';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.fontSize = '16px';
        button.innerHTML = '🏷️';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(button, 'click', function(e) {
            L.DomEvent.preventDefault(e);
            map.getContainer().classList.toggle('unit-labels-hidden');
        });
        return container;
    },
});
map.addControl(new UnitLabelToggleControl());
