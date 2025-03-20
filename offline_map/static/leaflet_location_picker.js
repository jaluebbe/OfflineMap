// Throttle function to limit the rate at which a function can fire
const throttle = (func, limit) => {
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

var coordinateControl = L.control({
    position: 'bottomright'
});
coordinateControl.onAdd = function(map) {
    this._div = L.DomUtil.create('div', 'coordinate-control');
    let tempSource = document.getElementById('coordinateControlTemplate');
    this._div.appendChild(tempSource.content.cloneNode(true));
    L.DomEvent.disableClickPropagation(this._div);
    return this._div;
}
coordinateControl.addTo(map);

const locationPickerLayer = L.layerGroup();
let markerPositionedByInput = false;
let isEditing = false;

function updateControl(position) {
    const resultDiv = document.getElementById('coordinate-result');
    resultDiv.innerHTML = `
        <div><b>Lat., Lon.</b></div>${position.latitude}, ${position.longitude}</div>
        <div><b>UTM</b></div><div>${position.utm}</div>
        <div><b>MGRS</b></div><div>${position.mgrs}</div>
    `;
    resultDiv.style.color = "black";
    document.getElementById('coordinate-input').value = '';
}

function updateMarker(position) {
    myMarker.setLatLng([position.latitude, position.longitude]);
    if (!map.hasLayer(myMarker)) {
        myMarker.addTo(locationPickerLayer);
    }
    if (!map.getBounds().contains(myMarker.getLatLng())) {
        map.setView(myMarker.getLatLng());
    }
}

function handleApiResponse(response) {
    if (response.status === 200) {
        return response.json();
    } else if (response.status === 400) {
        throw new Error("Invalid coordinate");
    } else {
        throw new Error("Unexpected error");
    }
}

function convertPosition(e) {
    if (!map.hasLayer(locationPickerLayer)) return;
    const latlng = e.latlng.wrap();
    fetch(`/api/convert_lat_lon?latitude=${latlng.lat}&longitude=${latlng.lng}`)
        .then(handleApiResponse)
        .then(position => {
            if (e.type === 'click' || e.type === 'locationfound') {
                updateMarker(position);
            }
            updateControl(position);
        })
        .catch(error => {
            console.error(error);
        });
}

myMarker.bindTooltip("", {
    direction: 'top'
})

function updateTooltip(plz, metadata) {
    const tooltipContent = `
        <div><b>PLZ</b>: ${plz || ''}</div>
        <div>${metadata.community_prefix || ''} ${metadata.community || ''}</div>
        <div>${metadata.district_prefix || ''} ${metadata.district || ''}</div>
        <div>${metadata.state_prefix || ''} ${metadata.state || ''}</div>
    `;
    myMarker._tooltip.setContent(tooltipContent);
}

function fetchPlzAndAgs(latlng) {
    const plzPromise = fetch(`/api/get_plz_from_lat_lon?latitude=${latlng.lat}&longitude=${latlng.lng}`)
        .then(handleApiResponse)
        .catch(() => (''));
    const agsPromise = fetch(`/api/get_ags_from_lat_lon?latitude=${latlng.lat}&longitude=${latlng.lng}`)
        .then(handleApiResponse)
        .catch(() => (''));
    Promise.all([plzPromise, agsPromise])
        .then(([plz, ags]) => {
            if (ags) {
                fetch(`/api/get_ags_metadata?ags=${ags}`)
                    .then(handleApiResponse)
                    .then(metadata => {
                        updateTooltip(plz, metadata);
                    })
                    .catch(error => {
                        console.error(error);
                        updateTooltip(plz, "");
                    });
            } else {
                updateTooltip(plz, "");
            }
        })
        .catch(error => {
            console.error(error);
            updateTooltip('', {});
        });
}

function processMapEvent(e) {
    const latlng = e.latlng.wrap();
    if (markerPositionedByInput) {
        markerPositionedByInput = false;
        return;
    }
    if (!isEditing) {
        convertPosition(e);
        fetchPlzAndAgs(e.latlng.wrap());
    }
}

myMarker.on('move', throttle(processMapEvent, 100));
map.on('click', processMapEvent);
map.on('locationfound', processMapEvent);

document.getElementById('coordinate-go-button').addEventListener('click', function() {
    handleCoordinateInput();
});

document.getElementById('coordinate-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        handleCoordinateInput();
    }
});

function handleCoordinateInput() {
    const coordinateInput = document.getElementById('coordinate-input').value;
    const resultDiv = document.getElementById('coordinate-result');
    if (coordinateInput.trim() === "") {
        map.locate();
        return;
    }
    fetch(`/api/parse_coordinate?coordinate=${encodeURIComponent(coordinateInput)}`)
        .then(handleApiResponse)
        .then(data => {
            markerPositionedByInput = true;
            updateControl(data);
            updateMarker(data);
        })
        .catch(error => {
            resultDiv.textContent = error.message;
            resultDiv.style.color = "red";
        });
}

layerControl.addOverlay(locationPickerLayer, "Location picker")
locationPickerLayer.addTo(map);
