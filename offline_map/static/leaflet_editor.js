map.createPane('editor');
map.getPane('editor').style.zIndex = 392;

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
    onEachFeature: function(feature, layer) {
        const properties = feature.properties || {};
        layer.options.pmIgnore = !!properties.pmIgnore;
        if (typeof properties.showMeasurements !== 'undefined') {
            layer.options.showMeasurements = properties.showMeasurements;
            applyMeasurements(layer);
        }
        if (properties.text && properties.text.trim() !== '') {
            layer.bindTooltip(properties.text);
        }
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
        layer.bindTooltip(text);
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
    applyMeasurements(layer);
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

function copyTooltipAndPopup(originalLayer, newLayer) {
    const tooltipContent = originalLayer.getTooltip()?.getContent();
    const popupContent = originalLayer.getPopup()?.getContent();
    if (tooltipContent) {
        newLayer.bindTooltip(tooltipContent);
    }
    if (popupContent) {
        newLayer.bindPopup(popupContent);
    }
}

function flattenAndAddMultiPolygon(newLayer) {
    const flattened = turf.flatten(newLayer.feature);
    flattened.features.forEach((polygonFeature) => {
        editorLayer.addData(polygonFeature);
    });
    editorLayer.removeLayer(newLayer);
}

map.on('pm:cut', function (eo) {
    const originalLayer = eo.originalLayer;
    const newLayer = eo.layer;
    if (originalLayer?.feature) {
        initializeFeature(newLayer, originalLayer);
        applyMeasurements(newLayer);
        copyTooltipAndPopup(originalLayer, newLayer);
        if (newLayer.feature.geometry?.type === 'MultiPolygon') {
            flattenAndAddMultiPolygon(newLayer);
        }
        if (typeof newLayer.eachLayer === 'function') {
            newLayer.eachLayer(function (layer) {
                initializeFeature(layer, originalLayer);
                applyMeasurements(layer);
                copyTooltipAndPopup(originalLayer, layer);
            });
        }
    }
});

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
