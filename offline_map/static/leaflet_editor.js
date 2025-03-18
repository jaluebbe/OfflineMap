map.createPane('editor');
map.getPane('editor').style.zIndex = 392;

var selectedShape = undefined;

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
    const data = editorLayer.toGeoJSON();
    localStorage.setItem('editorLayerData', JSON.stringify(data));
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
    colorInput.value = '#3388ff';
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
        console.warn('Kein Shape ausgewählt, um die Eigenschaften zu aktualisieren.');
        return;
    }
    const properties = selectedShape.feature.properties || {};
    properties.color = colorInput.value;
    properties.fill = fillCheckbox.checked;
    properties.showMeasurements = measureCheckbox.checked;
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
        if ('fill' in properties || 'color' in properties) {
            return L.circleMarker(latlng, properties);
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
map.pm.addControls({
    oneBlock: true,
});

map.on('pm:create', function(eo) {
    const layer = eo.layer;
    layer.feature = layer.feature || {
        type: 'Feature',
        properties: {}
    };
    const properties = layer.feature.properties;
    if (eo.shape !== 'Marker' && eo.shape !== 'Text') {
        properties.color = colorInput.value;
    }
    if (eo.shape !== 'Line' && eo.shape !== 'Text' && eo.shape !== 'Marker') {
        properties.fill = fillCheckbox.checked;
    }
    if (eo.shape !== 'Marker' && eo.shape !== 'CircleMarker' && eo.shape !== 'Text') {
        properties.showMeasurements = measureCheckbox.checked;
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

var featureControl = L.control({
    position: 'topleft'
});
featureControl.onAdd = function(map) {
    this._div = L.DomUtil.create('div', 'legend-control');
    let tempSource = document.getElementById('featureControlTemplate');
    this._div.appendChild(tempSource.content.cloneNode(true));
    L.DomEvent.disableClickPropagation(this._div);
    return this._div;
}
featureControl.addTo(map);

loadEditorLayerFromLocalStorage();
