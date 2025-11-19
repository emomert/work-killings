// Global data
let allAccidents = [];

// Icons
const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Initialize Map
const map = L.map('map').setView([39.9334, 32.8597], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Load Data
async function loadAccidents() {
    try {
        const response = await fetch('data.json');
        allAccidents = await response.json();

        if (allAccidents.length === 0) {
            console.log('Henüz veri yok');
            return;
        }

        populateFilters(allAccidents);
        filterData(); // Initial render

        console.log(`${allAccidents.length} iş cinayeti yüklendi`);

    } catch (error) {
        console.error('Veri yüklenirken hata:', error);
    }
}

function populateFilters(data) {
    const sectors = new Set();
    const cities = new Set();

    data.forEach(item => {
        if (item.sector) sectors.add(item.sector);
        if (item.city) cities.add(item.city);
    });

    const sectorSelect = document.getElementById('filter-sector');
    const citySelect = document.getElementById('filter-city');

    Array.from(sectors).sort().forEach(sector => {
        const option = document.createElement('option');
        option.value = sector;
        option.textContent = sector;
        sectorSelect.appendChild(option);
    });

    Array.from(cities).sort().forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        citySelect.appendChild(option);
    });

    document.getElementById('filter-age-min').addEventListener('input', filterData);
    document.getElementById('filter-age-max').addEventListener('input', filterData);
    document.getElementById('filter-gender').addEventListener('change', filterData);
    document.getElementById('filter-sector').addEventListener('change', filterData);
    document.getElementById('filter-city').addEventListener('change', filterData);
    document.getElementById('filter-reset-btn').addEventListener('click', resetFilters);

    // Add sidebar toggle functionality
    const filterToggleBtn = document.getElementById('filter-toggle-btn');
    const filterSidebar = document.getElementById('filter-sidebar');
    const filterCloseBtn = document.getElementById('filter-close-btn');

    filterToggleBtn.addEventListener('click', () => {
        filterSidebar.classList.remove('hidden');
    });

    filterCloseBtn.addEventListener('click', () => {
        filterSidebar.classList.add('hidden');
    });
}

function resetFilters() {
    document.getElementById('filter-age-min').value = '';
    document.getElementById('filter-age-max').value = '';
    document.getElementById('filter-gender').value = '';
    document.getElementById('filter-sector').value = '';
    document.getElementById('filter-city').value = '';
    filterData();
}

function filterData() {
    const ageMin = parseInt(document.getElementById('filter-age-min').value) || 0;
    const ageMax = parseInt(document.getElementById('filter-age-max').value) || 100;
    const gender = document.getElementById('filter-gender').value;
    const sector = document.getElementById('filter-sector').value;
    const city = document.getElementById('filter-city').value;

    const filtered = allAccidents.filter(item => {
        const itemMin = item.age_min || 0;
        const itemMax = item.age_max || 100;

        // Age filter logic: overlap
        if (itemMin > ageMax) return false;
        if (itemMax < ageMin) return false;

        if (gender && item.gender !== gender) return false;
        if (sector && item.sector !== sector) return false;
        if (city && item.city !== city) return false;

        return true;
    });

    renderMap(filtered);
    renderTable(filtered);
}

function renderMap(data) {
    // Clear existing markers
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    data.forEach(accident => {
        const popupContent = `
            <h3>${accident.location || 'Konum bilinmiyor'}</h3>
            <p><strong>Tarih:</strong> ${accident.date || 'Bilinmiyor'}</p>
            <p><strong>Kurban(lar):</strong> <a href="profile.html?id=${accident.id}" class="popup-link">${accident.victims.join(', ')}</a></p>
            <p><strong>Neden:</strong> ${accident.cause || 'Belirtilmemiş'}</p>
            <p><strong>Sektör:</strong> ${accident.sector || 'Belirtilmemiş'}</p>
            <a href="profile.html?id=${accident.id}" class="profile-link-btn">Profili Görüntüle</a>
        `;

        L.marker(accident.coords, { icon: redIcon })
            .addTo(map)
            .bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
            });
    });
}

function renderTable(data) {
    const tbody = document.getElementById('accident-table-body');
    if (!tbody) return; // Guard clause

    tbody.innerHTML = '';

    data.forEach(accident => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${accident.date}</td>
            <td>${accident.city}</td>
            <td>${accident.district}</td>
            <td>${accident.sector}</td>
            <td><a href="profile.html?id=${accident.id}" class="table-link">${accident.victims.join(', ')}</a></td>
            <td>${accident.cause}</td>
        `;
        tbody.appendChild(row);
    });
}

// View Switching Logic
const mapViewBtn = document.getElementById('mapViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');

if (mapViewBtn && tableViewBtn) {
    mapViewBtn.addEventListener('click', () => switchView('map'));
    tableViewBtn.addEventListener('click', () => switchView('table'));
}

function switchView(viewName) {
    // Update Hash (URL)
    // This will trigger the hashchange event, which handles the actual UI update
    // If we are already on the view, replacing the hash won't trigger a change if it's the same,
    // so we also manually call updateUI if needed, but usually hash change is enough.
    // To avoid loops, we only set hash if it's different.
    if (window.location.hash !== `#${viewName}`) {
        window.location.hash = viewName;
    } else {
        updateUI(viewName);
    }
}

function updateUI(viewName) {
    // Normalize viewName
    const targetView = (viewName === 'table') ? 'table' : 'map';

    // Hide all views
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.view-toggle button').forEach(el => el.classList.remove('active'));

    // Update Body Class for CSS styling
    document.body.classList.remove('view-map', 'view-table');
    document.body.classList.add('view-' + targetView);

    // Show selected view
    if (targetView === 'map') {
        document.getElementById('map-container').classList.add('active');
        document.getElementById('mapViewBtn').classList.add('active');
        setTimeout(() => map.invalidateSize(), 100); // Fix map rendering issues
    } else {
        document.getElementById('table-container').classList.add('active');
        document.getElementById('tableViewBtn').classList.add('active');
    }
}

// Handle Hash Change
window.addEventListener('hashchange', () => {
    const viewName = window.location.hash.replace('#', '');
    updateUI(viewName);
});

// Initialize based on current hash or default to map
const initialView = window.location.hash.replace('#', '') || 'map';
updateUI(initialView);

// Event Listeners for Buttons
document.getElementById('mapViewBtn').addEventListener('click', () => switchView('map'));
document.getElementById('tableViewBtn').addEventListener('click', () => switchView('table'));

// Start
loadAccidents();
