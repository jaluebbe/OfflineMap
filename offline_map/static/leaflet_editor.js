map.createPane('editor');
map.getPane('editor').style.zIndex = 392;

const editorLayer = L.geoJSON([], {
    pane: 'editor',
}).addTo(map);
layerControl.addOverlay(editorLayer, "Editor");
map.pm.setGlobalOptions({
    layerGroup: editorLayer,
});

function toggleMapClick(e) {
    if (e.enabled) {
        map.off('click', convertPosition);
    } else {
        map.on('click', convertPosition);
    }
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
map.pm.addControls();

L.Polygon.prototype.options.measurementOptions = {
    ha: true,
    showOnHover: true
};
L.Polyline.prototype.options.measurementOptions = {
    showOnHover: true
};
L.Polyline.prototype.options.showMeasurements = true;

const showMeasurements = L.layerGroup();
layerControl.addOverlay(showMeasurements, "Show measurements");
map.on('overlayadd', function(eventLayer) {
    if (eventLayer.name === 'Show measurements') {
        L.Polygon.prototype.options.measurementOptions.showOnHover = false;
        L.Polyline.prototype.options.measurementOptions.showOnHover = false;
    }
});
map.on('overlayremove', function(eventLayer) {
    if (eventLayer.name === 'Show measurements') {
        L.Polygon.prototype.options.measurementOptions.showOnHover = true;
        L.Polyline.prototype.options.measurementOptions.showOnHover = true;
    }
});
