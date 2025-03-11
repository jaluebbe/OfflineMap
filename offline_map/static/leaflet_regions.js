map.createPane('regions');
map.getPane('regions').style.zIndex = 390;

function formatRegionTooltip(metadata) {
    return `
        <div>${metadata.community_prefix || ''} ${metadata.community || ''}</div>
        <div>${metadata.district_prefix || ''} ${metadata.district || ''}</div>
        <div>${metadata.state_prefix || ''} ${metadata.state || ''}</div>
    `;
}

function onEachRegionFeature(feature, layer) {
    layer.bindTooltip(formatRegionTooltip(feature.properties), {
        sticky: true,
        direction: "top",
    });
}

let regionsLayer = L.geoJSON([], {
    onEachFeature: onEachRegionFeature,
    pane: 'regions',
    style: function(feature) {
        return {
            color: '#101010',
            fillColor: 'blue',
            opacity: 0.3,
            fillOpacity: 0.05,
            weight: 2,
        };
    },
    showMeasurements: false,
}).addTo(map);
layerControl.addOverlay(regionsLayer, "Regions");

async function fetchAndPopulateDropdown(baseUrl, ags, dropdown, defaultOptionText, onChangeCallback) {
    dropdown.innerHTML = `<option value="">${defaultOptionText}</option>`;
    const url = new URL(baseUrl, window.location.origin);
    if (ags != null && ags.length == 0) {
        dropdown.disabled = true;
        return;
    } else if (ags) {
        url.searchParams.append('ags', ags);
    }
    try {
        const response = await fetch(url);
        const data = await response.json();
        for (const [key, value] of Object.entries(data)) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = key;
            dropdown.appendChild(option);
        }
        dropdown.disabled = false;
        if (dropdown.options.length === 2) {
            dropdown.selectedIndex = 1;
            onChangeCallback();
        }
    } catch (error) {
        console.error(`Error fetching data from ${baseUrl}:`, error);
        dropdown.disabled = true;
    }
}

async function populateStateDropdown() {
    const stateSelect = document.getElementById('state-select');
    await fetchAndPopulateDropdown('/api/get_state_ags', null, stateSelect, 'State selection', stateSelectionChanged);
}

async function populateDistrictDropdown(stateAgs) {
    const districtSelect = document.getElementById('district-select');
    await fetchAndPopulateDropdown('/api/get_district_ags', stateAgs, districtSelect, 'District selection', districtSelectionChanged);
}

async function populateCommunityDropdown(districtAgs) {
    const communitySelect = document.getElementById('community-select');
    await fetchAndPopulateDropdown('/api/get_community_ags', districtAgs, communitySelect, 'Community selection', communitySelectionChanged);
}

async function fetchAndAddGeoJSON(baseUrl, ags, layer) {
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.append('ags', ags);
    try {
        const response = await fetch(url);
        const geojson = await response.json();
        layer.addData(geojson);
        const bounds = layer.getBounds();
        map.fitBounds(bounds);
    } catch (error) {
        console.error(`Error fetching features from ${baseUrl}:`, error);
    }
}

async function handleSelectionChange(baseUrl, selectedValue, nextDropdownFunction, fallbackFunction) {
    regionsLayer.clearLayers();
    if (selectedValue.length > 1) {
        await fetchAndAddGeoJSON(baseUrl, selectedValue, regionsLayer);
    } else if (fallbackFunction) {
        await fallbackFunction();
    }
    if (nextDropdownFunction) {
        await nextDropdownFunction(selectedValue);
    }
}

async function stateSelectionChanged() {
    const stateSelect = document.getElementById('state-select');
    const selectedValue = stateSelect.value;
    await handleSelectionChange('/api/get_features_for_ags', selectedValue, populateDistrictDropdown);
    const communitySelect = document.getElementById('community-select');
    communitySelect.innerHTML = '<option value="">Select a community</option>';
    communitySelect.disabled = true;
}

async function districtSelectionChanged() {
    const districtSelect = document.getElementById('district-select');
    const selectedValue = districtSelect.value;
    await handleSelectionChange('/api/get_features_for_ags', selectedValue, populateCommunityDropdown, stateSelectionChanged);
}

async function communitySelectionChanged() {
    const communitySelect = document.getElementById('community-select');
    const selectedValue = communitySelect.value;
    await handleSelectionChange('/api/get_features_for_ags', selectedValue, null, districtSelectionChanged);
}

populateStateDropdown();
