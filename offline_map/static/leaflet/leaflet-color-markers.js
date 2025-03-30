// Icons are from https://github.com/pointhi/leaflet-color-markers

const MARKER_IMAGE_PATH = '/static/leaflet/images/';

let ColorIcon = L.Icon.extend({
    options: {
        shadowUrl: `${MARKER_IMAGE_PATH}marker-shadow.png`,
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
    }
});

const blueIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-blue.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-blue.png`
});
const goldIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-gold.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-gold.png`
});
const redIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-red.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-red.png`
});
const greenIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-green.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-green.png`
});
const orangeIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-orange.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-orange.png`
});
const yellowIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-yellow.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-yellow.png`
});
const violetIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-violet.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-violet.png`
});
const greyIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-grey.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-grey.png`
});
const blackIcon = new ColorIcon({
    iconUrl: `${MARKER_IMAGE_PATH}marker-icon-black.png`,
    iconRetinaUrl: `${MARKER_IMAGE_PATH}marker-icon-2x-black.png`
});