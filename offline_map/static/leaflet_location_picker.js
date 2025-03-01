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

const locationPickerLayer = L.layerGroup();

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
    if (!map.hasLayer(locationPickerLayer))
        return;
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

myMarker.on('move', throttle(convertPosition, 100));
map.on('click', convertPosition);
map.on('locationfound', convertPosition);

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
