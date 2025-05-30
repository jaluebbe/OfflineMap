map.createPane('plz');
map.getPane('plz').style.zIndex = 391;

let selectedPlz = "";

function onEachPlzFeature(feature, layer) {
    layer.bindTooltip(`<div><b>PLZ</b>: ${feature.properties.plz}</div>`, {
        sticky: true,
        direction: "top",
    });
}

const plzLayer = L.geoJSON([], {
    onEachFeature: onEachPlzFeature,
    pane: 'plz',
    style: function(feature) {
        return {
            color: '#8b4000',
            fillColor: 'yellow',
            opacity: 0.4,
            fillOpacity: 0.1,
            weight: 2,
        };
    },
    pmIgnore: true,
    showMeasurements: false,
}).addTo(map);
layerControl.addOverlay(plzLayer, "PLZ");

async function plzChanged() {
    const plzInput = document.getElementById('plz-input').value.trim();
    plzLayer.clearLayers();
    selectedPlz = plzInput;
    if (plzInput.length < 2) {
        return;
    }
    try {
        const response = await fetch(`/api/get_features_for_plz?plz=${plzInput}`);
        const geojson = await response.json();
        if (response.ok) {
            plzLayer.addData(geojson);
            if (geojson.length > 0 && map.hasLayer(plzLayer)) {
                const bounds = plzLayer.getBounds();
                map.fitBounds(bounds);
            }
        }
    } catch (error) {
        console.error('Error fetching features for PLZ:', error);
    }
}
