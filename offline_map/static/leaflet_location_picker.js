// Throttle function to limit the rate at which a function can fire
var throttle = function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

const myMarker = L.marker([50, 8.6], {
    draggable: true,
    zIndexOffset: 1000,
    icon: L.icon({
        iconUrl: '/static/img/level_staff_red.svg',
        shadowUrl: '/static/img/level_staff_shadow.png',
        shadowSize: [46, 66],
        shadowAnchor: [0, 66],
        iconSize: [10, 121],
        iconAnchor: [5, 121],
        tooltipAnchor: [0, -121]
    })
});

myMarker.bindTooltip("", {
    direction: 'top'
});

function convertPosition(e) {
    const xhr = new XMLHttpRequest();
    const latlng = e.latlng.wrap();
    xhr.open('GET', `/api/convert_lat_lon?latitude=${latlng.lat}&longitude=${latlng.lng}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
        if (xhr.status === 200) {
            const position = JSON.parse(xhr.responseText);
            if (e.type === 'click' || e.type === 'locationfound') {
                myMarker.setLatLng(latlng);
                if (!map.hasLayer(myMarker)) {
                    myMarker.addTo(map);
                }
                if (!map.getBounds().contains(myMarker.getLatLng())) {
                    map.panInside(myMarker.getLatLng());
                }
            }
            myMarker._tooltip.setContent(
                `<b>${position.latitude}, ${position.longitude}</b><br>${position.utm}<br>${position.mgrs}`
            );
        }
    };
    xhr.send();
}

myMarker.on('move', throttle(convertPosition, 100));
map.on('click', convertPosition);
map.on('locationfound', convertPosition);
map.locate();
