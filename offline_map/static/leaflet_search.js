map.createPane('search');
map.getPane('search').style.zIndex = 390;

function formatSearchTooltip(metadata) {
    const tooltipContent = [];
    if (metadata.name) {
        tooltipContent.push(`<div><b>${metadata.name}</b> (${metadata.place})</div>`);
        tooltipContent.push(`<div><b>PLZ</b>: ${metadata.plz}</div>`);
    }
    tooltipContent.push(`<div>${metadata.community_prefix || ''} ${metadata.community || ''}</div>`);
    tooltipContent.push(`<div>${metadata.district_prefix || ''} ${metadata.district || ''}</div>`);
    tooltipContent.push(`<div>${metadata.state_prefix || ''} ${metadata.state || ''}</div>`);
    return tooltipContent.join('');
}

function onEachSearchFeature(feature, layer) {
    layer.bindTooltip(formatSearchTooltip(feature.properties), {
        sticky: true,
        direction: "top",
    });
}
const placesLayer = L.geoJSON([], {
    onEachFeature: onEachSearchFeature,
    pointToLayer: function(feature, latlng) {
        return L.marker(latlng, {
            icon: greenIcon
        });
    },
    style: function(feature) {
        return { color: 'green' };
    },
    pane: 'search',
    showMeasurements: false,
});

function formatStreetTooltip(metadata) {
    return `
        <div><b>${metadata.name}</b></div>
        <div><b>PLZ</b>: ${metadata.plz}</div>
        <div>${metadata.community_prefix || ''} ${metadata.community || ''}</div>
        <div>${metadata.district_prefix || ''} ${metadata.district || ''}</div>
        <div>${metadata.state_prefix || ''} ${metadata.state || ''}</div>
    `;
}

function onEachStreetFeature(feature, layer) {
    layer.bindTooltip(formatStreetTooltip(feature.properties), {
        sticky: true,
        direction: "top",
    });
}
const streetsLayer = L.geoJSON([], {
    onEachFeature: onEachStreetFeature,
    pointToLayer: function(feature, latlng) {
        return L.marker(latlng, {
            icon: redIcon
        });
    },
    pane: 'search',
    showMeasurements: false,
});

const searchLayer = L.layerGroup([streetsLayer, placesLayer]).addTo(map);
layerControl.addOverlay(searchLayer, "Search results");

function fitBoundsToLayers() {
    const bounds = L.latLngBounds([]);
    if (streetsLayer.getLayers().length > 0) {
        bounds.extend(streetsLayer.getBounds());
    }
    if (placesLayer.getLayers().length > 0) {
        bounds.extend(placesLayer.getBounds());
    }
    if (typeof editorLayer !== 'undefined' && editorLayer.getLayers().length > 0) {
        bounds.extend(editorLayer.getBounds());
    }
    if (bounds.isValid()) {
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
            map.setView(bounds.getCenter(), 16);
        } else {
            map.fitBounds(bounds);
        }
    }
}

async function handleStreetInput() {
    const streetInput = document.getElementById('street-input').value;
    const goButton = document.getElementById('street-go-button');
    goButton.disabled = true;
    streetsLayer.clearLayers();
    if (!streetInput.trim()) {
        goButton.disabled = false;
        return;
    }
    try {
        const streetUrl = new URL('/api/query_streets', window.location.origin);
        streetUrl.searchParams.append('search_term', streetInput);
        streetUrl.searchParams.append('ags', selectedAgs);
        streetUrl.searchParams.append('plz', selectedPlz);
        streetUrl.searchParams.append('include_metadata', true);
        const response = await fetch(streetUrl);
        const data = await response.json();
        const streetsGeoJSON = {
            type: "FeatureCollection",
            features: data.map(street => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [street.longitude, street.latitude]
                },
                properties: {
                    ...street
                }
            }))
        };
        streetsLayer.addData(streetsGeoJSON);
        fitBoundsToLayers();
    } catch (error) {
        console.error('Error fetching street data:', error);
    } finally {
        goButton.disabled = false;
    }
}

async function handlePlaceInput() {
    const placeInput = document.getElementById('place-input').value;
    const goButton = document.getElementById('place-go-button');
    goButton.disabled = true;
    placesLayer.clearLayers();
    if (!placeInput.trim()) {
        goButton.disabled = false;
        return;
    }
    try {
        const locationUrl = new URL('/api/query_location', window.location.origin);
        locationUrl.searchParams.append('search_term', placeInput);
        locationUrl.searchParams.append('ags', selectedAgs);
        locationUrl.searchParams.append('plz', selectedPlz);
        locationUrl.searchParams.append('distinct', 'true');
        const locationResponse = await fetch(locationUrl);
        const locationData = await locationResponse.json();
        for (const item of locationData) {
            const featureUrl = new URL('/api/get_features_for_ags', window.location.origin);
            featureUrl.searchParams.append('ags', item.ags);
            const featureResponse = await fetch(featureUrl);
            const featureGeojson = await featureResponse.json();
            placesLayer.addData(featureGeojson);
        }
        const placesUrl = new URL('/api/query_places', window.location.origin);
        placesUrl.searchParams.append('search_term', placeInput);
        placesUrl.searchParams.append('ags', selectedAgs);
        placesUrl.searchParams.append('plz', selectedPlz);
        placesUrl.searchParams.append('include_metadata', true);
        const placesResponse = await fetch(placesUrl);
        const placesData = await placesResponse.json();
        const placesGeoJSON = {
            type: "FeatureCollection",
            features: placesData.map(place => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [place.longitude, place.latitude]
                },
                properties: {
                    ...place
                }
            }))
        };
        placesLayer.addData(placesGeoJSON);
        fitBoundsToLayers();
    } catch (error) {
        console.error('Error fetching place data:', error);
    } finally {
        goButton.disabled = false;
    }
}

function addInputEventListeners(inputId, buttonId, handler) {
    document.getElementById(buttonId).addEventListener('click', handler);
    document.getElementById(inputId).addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            handler();
        }
    });
}

addInputEventListeners('street-input', 'street-go-button', handleStreetInput);
addInputEventListeners('place-input', 'place-go-button', handlePlaceInput);
