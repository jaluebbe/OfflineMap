// Icons are from https://github.com/pointhi/leaflet-color-markers
let ColorIcon = L.Icon.extend({
    options: {
        shadowUrl: 'leaflet/images/marker-shadow.png',
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
    }
});
const blueIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-blue.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-blue.png'
});
const goldIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-gold.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-gold.png'
});
const redIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-red.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-red.png'
});
const greenIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-green.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-green.png'
});
const orangeIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-orange.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-orange.png'
});
const yellowIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-yellow.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-yellow.png'
});
const violetIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-violet.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-violet.png'
});
const greyIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-grey.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-grey.png'
});
const blackIcon = new ColorIcon({
    iconUrl: 'leaflet/images/marker-icon-black.png',
    iconRetinaUrl: 'leaflet/images/marker-icon-2x-black.png'
});
