map.createPane('editor');
map.getPane('editor').style.zIndex = 392;

const editorLayer = L.geoJSON([], {
    pane: 'editor',
    onEachFeature: function(feature, layer) {
        const properties = feature.properties || {};
        layer.options.pmIgnore = !!properties.pmIgnore;
        if (typeof properties.showMeasurements !== 'undefined') {
            layer.options.showMeasurements = properties.showMeasurements;
            if (typeof layer.showMeasurements === 'function' && layer.options.showMeasurements) {
                layer.showMeasurements();
            } else if (typeof layer.hideMeasurements === 'function') {
                layer.hideMeasurements();
            }
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
        const properties = layer.feature?.properties || {};
        if (typeof layer.showMeasurements === 'function') {
            if (properties.showMeasurements) {
                layer.showMeasurements();
            } else {
                layer.hideMeasurements();
            }
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
        properties: {
            color: colorInput.value,
            fill: fillCheckbox.checked,
            showMeasurements: measureCheckbox.checked,
        }
    };
    const properties = layer.feature.properties;
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
    if (typeof layer.showMeasurements === 'function') {
        if (properties.showMeasurements) {
            layer.showMeasurements();
        } else {
            layer.hideMeasurements();
        }
    }
});

map.on('pm:cut', function(eo) {
    const originalLayer = eo.originalLayer;
    const newLayer = eo.layer;
    if (originalLayer?.feature) {
        newLayer.feature = newLayer.feature || {
            type: 'Feature',
            properties: {}
        };
        newLayer.feature.properties = {
            ...originalLayer.feature.properties
        };
        const properties = newLayer.feature.properties;
        if (properties.showMeasurements) {
            newLayer.showMeasurements();
        } else {
            newLayer.hideMeasurements();
        }
        const tooltipContent = originalLayer.getTooltip()?.getContent();
        const popupContent = originalLayer.getPopup()?.getContent();
        if (tooltipContent) {
            newLayer.bindTooltip(tooltipContent);
        }
        if (popupContent) {
            newLayer.bindPopup(popupContent);
        }
        if (newLayer.feature.geometry?.type === 'MultiPolygon') {
            const flattened = turf.flatten(newLayer.feature);
            flattened.features.forEach((polygonFeature) => {
                editorLayer.addData(polygonFeature)
            });
            editorLayer.removeLayer(newLayer);
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
