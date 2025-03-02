var wmsHamburgDOP = L.tileLayer.wms('https://geodienste.hamburg.de/HH_WMS_DOP', {
    layers: 'DOP',
    format: 'image/png',
    transparent: true,
    attribution: '&copy <a href="https://www.hamburg.de/bsw/landesbetrieb-geoinformation-und-vermessung/">' +
        'Freie und Hansestadt Hamburg, LGV</a>',
    minZoom: 12,
    maxZoom: 22,
    bounds: [
        [53.3, 8.4],
        [54, 10.4]
    ]
});
var wmsNiDOP = L.tileLayer.wms('https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms', {
    layers: 'ni_dop20',
    format: 'image/png',
    transparent: true,
    attribution: '&copy <a href="https://www.lgln.niedersachsen.de">LGLN</a> (2025) <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
    minZoom: 12,
    maxZoom: 22,
    bounds: [
        [51.29, 6.6],
        [53.9, 11.6]
    ]
});
var wmsNWDOP = L.tileLayer.wms('https://www.wms.nrw.de/geobasis/wms_nw_dop', {
    layers: 'nw_dop_rgb',
    format: 'image/png',
    transparent: true,
    attribution: '&copy <a href="https://www.bezreg-koeln.nrw.de/geobasis-nrw">Bezirksregierung Köln</a>',
    minZoom: 12,
    maxZoom: 22,
    bounds: [
        [50.3, 5.8],
        [52.4, 9.5]
    ]
});
var wmsSHDOP = L.tileLayer.wms('https://dienste.gdi-sh.de/WMS_SH_DOP20col_OpenGBD', {
    layers: 'sh_dop20_rgb',
    format: 'image/png',
    transparent: true,
    attribution: '&copy GeoBasis-DE/LVermGeo SH/<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>',
    minZoom: 12,
    maxZoom: 22,
    bounds: [
        [55, 7.8],
        [53.4, 11.4]
    ]
});
var wmsHBDOP = L.tileLayer.wms('https://geodienste.bremen.de/wms_dop20_2023', {
    layers: 'DOP20_2023_HB,DOP20_2023_BHV',
    format: 'image/png',
    transparent: true,
    attribution: '&copy <a href="https://www.geo.bremen.de/">Landesamt GeoInformation Bremen</a>',
    minZoom: 12,
    maxZoom: 22,
    bounds: [
        [53, 8.4],
        [53.61, 9]
    ]
});

if (location.protocol === 'https:') {
    var dopLayerGroup = L.layerGroup([wmsHamburgDOP, wmsNiDOP, wmsNWDOP, wmsSHDOP, wmsHBDOP], {
        minZoom: 12,
        maxZoom: 22
    });
    layerControl.addBaseLayer(dopLayerGroup, "DOP");
} else {
    console.warn('Running in offline mode. DOP imagery will not be available.');
}
