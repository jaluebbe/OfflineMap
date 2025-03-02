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
var wmsHeDOP = L.tileLayer.wms('https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-images.ows', {
    layers: 'he_dop_rgb',
    format: 'image/png',
    transparent: true,
    attribution: '&copy <a href="https://hvbg.hessen.de/">HVBG</a>',
    minZoom: 12,
    maxZoom: 22,
    bounds: [
        [49.25, 7.41867],
        [51.7596, 10.5]
    ]
});
var wmsSLDOP = L.tileLayer.wms('https://geoportal.saarland.de/freewms/dop2023', {
    layers: 'sl_dop20_rgb',
    format: 'image/png',
    transparent: true,
    attribution: '&copy GeoBasis DE/LVGL-SL (2025) <a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>',
    minZoom: 12,
    maxZoom: 22,
    bounds: [
        [49.0829, 6.3406],
        [49.6598, 7.43817]
    ]
});
var wmsRPDOP = L.tileLayer.wms('https://geo4.service24.rlp.de/wms/rp_dop20.fcgi', {
    layers: 'rp_dop20',
    format: 'image/png',
    transparent: true,
    attribution: '&copy GeoBasis-DE / <a href="http://www.lvermgeo.rlp.de">LVermGeoRP</a> (2025) <a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a> [Daten bearbeitet]',
    minZoom: 12,
    maxZoom: 22,
    bounds: [
        [48.897996, 6.037773],
        [51.000893, 8.617703]
    ]
}).addTo(map)

if (location.protocol === 'https:') {
    var dopLayerGroup = L.layerGroup(
        [
            wmsHamburgDOP, wmsNiDOP, wmsNWDOP, wmsSHDOP, wmsHBDOP, wmsHeDOP, wmsSLDOP, wmsRPDOP
        ], {
            minZoom: 12,
            maxZoom: 22
        });
    layerControl.addBaseLayer(dopLayerGroup, "DOP");
} else {
    console.warn('Running in offline mode. DOP imagery will not be available.');
}
