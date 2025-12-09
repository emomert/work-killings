// Global data
let allAccidents = [];
let currentFilteredData = []; // Store filtered data for CSV export

const SECTOR_OPTIONS = [
    "İnşaat, Yol",
    "Taşımacılık",
    "Diğer İşkolları",
    "Tarım, Orman (İşçi)",
    "Tarım, Orman (Çiftçi)",
    "Ticaret, Büro",
    "Madencilik",
    "Belediye, Genel İşler",
    "Kimya",
    "Metal",
    "Konaklama",
];

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

// Custom cluster icon function - red marker with number on top
function createClusterIcon(cluster) {
    const count = cluster.getChildCount();
    
    return L.divIcon({
        html: `<div class="cluster-marker-wrapper">
                   <img src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png" class="cluster-marker-shadow" />
                   <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" class="cluster-marker-icon" />
                   <div class="cluster-number-badge">${count}</div>
               </div>`,
        className: 'marker-cluster-custom',
        iconSize: L.point(41, 53),
        iconAnchor: L.point(20, 52)
    });
}

// Marker Cluster Group (global so we can clear it)
let markers = L.markerClusterGroup({
    maxClusterRadius: 35, // Reduced from 50 - smaller radius = less clustering, more individual markers visible
    disableClusteringAtZoom: 11, // Disable clustering at zoom level 11+ (show all individual markers when zoomed in)
    spiderfyOnMaxZoom: true, // Spread markers when clicking cluster at max zoom
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    chunkedLoading: true, // Performance optimization for large datasets
    chunkDelay: 50, // Delay between chunks (ms)
    chunkInterval: 200, // Time between chunks (ms)
    iconCreateFunction: createClusterIcon,
    chunkProgress: function(processed, total, elapsed, layersArray) {
        // Progress callback - can be used for loading indicator if needed
    }
});
map.addLayer(markers);

// Load Data
async function loadAccidents() {
    try {
        const response = await fetch(`data.json?ts=${Date.now()}`, { cache: 'no-store' });
        allAccidents = await response.json();

        if (allAccidents.length === 0) {
            console.log('Henüz veri yok');
            return;
        }

        populateFilters(allAccidents);
        
        // Initialize filtered data with all accidents
        currentFilteredData = allAccidents;
        filterData(); // Initial render

        console.log(`${allAccidents.length} iş cinayeti yüklendi`);

    } catch (error) {
        console.error('Veri yüklenirken hata:', error);
    }
}

function populateFilters(data) {
    const sectors = new Set(SECTOR_OPTIONS);
    const cities = new Set();

    data.forEach(item => {
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
    const ageMax = parseInt(document.getElementById('filter-age-max').value) || 150;
    const gender = document.getElementById('filter-gender').value;
    const sector = document.getElementById('filter-sector').value;
    const city = document.getElementById('filter-city').value;

    const filtered = allAccidents.filter(item => {
        const amin = (typeof item.age_min === 'number') ? item.age_min : null;
        const amax = (typeof item.age_max === 'number') ? item.age_max : null;
        const exactAge = (typeof item.age === 'number') ? item.age : null;

        // Age range overlap logic
        if (amin !== null || amax !== null) {
            const lo = amin !== null ? amin : (amax !== null ? amax : 0);
            const hi = amax !== null ? amax : (amin !== null ? amin : 150);
            if (lo > ageMax) return false;
            if (hi < ageMin) return false;
        } else if (exactAge !== null) {
            if (exactAge < ageMin) return false;
            if (exactAge > ageMax) return false;
        }

        if (gender && item.gender !== gender) return false;
        if (sector && item.sector !== sector) return false;
        if (city && item.city !== city) return false;

        return true;
    });

    // Store filtered data for CSV export
    currentFilteredData = filtered;
    
    renderMap(filtered);
    renderTable(filtered);
}

function renderMap(data) {
    // Clear existing markers from cluster group
    markers.clearLayers();

    // Batch process markers for better performance
    const markerArray = [];
    
    data.forEach(accident => {
        if (!isValidCoords(accident.coords)) {
            console.warn('Geçersiz koordinat, harita işaretçisi atlandı:', accident);
            return;
        }
        const popupContent = `
            <div style="background: linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%); padding: 14px 16px; border-bottom: 1px solid #333; margin: -1px -1px 0 -1px;">
                <div style="margin: 0 0 2px 0; font-size: 16px; font-weight: 600; color: #ffffff;">${escapeHtml(accident.person_name || 'İsimsiz İşçi')}</div>
                <div style="font-size: 12px; color: #888;">${escapeHtml(accident.date || 'Tarih bilinmiyor')}</div>
            </div>
            <div style="padding: 12px 16px;">
                <div style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 13px;">
                    <span style="color: #777;">Konum</span>
                    <span style="color: #d0d0d0; text-align: right; max-width: 180px;">${escapeHtml(accident.city || 'Bilinmiyor')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 13px;">
                    <span style="color: #777;">Yaş</span>
                    <span style="color: #d0d0d0;">${escapeHtml(String(accident.age || '-'))}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px;">
                    <span style="color: #777;">Sektör</span>
                    <span style="color: #d0d0d0; text-align: right;">${escapeHtml(accident.sector || '-')}</span>
                </div>
                <div style="padding: 10px 0 0 0; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 13px;">
                    <div style="color: #777; margin-bottom: 4px;">Ölüm Nedeni</div>
                    <div style="color: #bbb; font-style: italic; line-height: 1.5;">${escapeHtml(accident.cause || '-')}</div>
                </div>
            </div>
            <div style="padding: 12px 16px; background: rgba(0,0,0,0.25); margin: 0 -1px -1px -1px;">
                <a href="profile.html?id=${escapeHtml(accident.id)}" class="profile-link-btn">Daha Çok Bilgi</a>
            </div>
        `;

        const marker = L.marker(accident.coords, { icon: redIcon })
            .bindPopup(popupContent, {
                maxWidth: 300,
                className: 'custom-popup'
            });
        
        markerArray.push(marker);
    });

    // Add all markers to cluster group at once (more efficient)
    markers.addLayers(markerArray);
}

// Helper function to escape HTML (security)
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function isValidCoords(coords) {
    return Array.isArray(coords) &&
        coords.length === 2 &&
        coords.every(val => typeof val === 'number' && Number.isFinite(val));
}

// Parse date string (DD.MM.YYYY format) to Date object for sorting
function parseDate(dateStr) {
    if (!dateStr) return new Date(0); // Very old date for items without dates
    
    // Handle Turkish month names or DD.MM.YYYY format
    const turkishMonths = {
        'Ocak': '01', 'Şubat': '02', 'Mart': '03', 'Nisan': '04',
        'Mayıs': '05', 'Haziran': '06', 'Temmuz': '07', 'Ağustos': '08',
        'Eylül': '09', 'Ekim': '10', 'Kasım': '11', 'Aralık': '12'
    };
    
    // Try DD.MM.YYYY format
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        const date = new Date(`${year}-${month}-${day}`);
        if (!isNaN(date.getTime())) return date;
    }
    
    // Try Turkish month format (e.g., "15 Ocak 2024")
    for (const [monthName, monthNum] of Object.entries(turkishMonths)) {
        if (dateStr.includes(monthName)) {
            const yearMatch = dateStr.match(/\d{4}/);
            const dayMatch = dateStr.match(/\d{1,2}/);
            if (yearMatch && dayMatch) {
                const day = dayMatch[0].padStart(2, '0');
                const year = yearMatch[0];
                const date = new Date(`${year}-${monthNum}-${day}`);
                if (!isNaN(date.getTime())) return date;
            }
        }
    }
    
    // Fallback: try to parse as-is
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function renderTable(data) {
    const tbody = document.getElementById('accident-table-body');
    if (!tbody) return; // Guard clause

    // Sort by date (newest first)
    const sortedData = [...data].sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateB - dateA; // Descending order (newest first)
    });

    tbody.innerHTML = '';

    sortedData.forEach(accident => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><a href="profile.html?id=${escapeHtml(accident.id)}" class="table-link">${escapeHtml(accident.person_name || 'İsimsiz İşçi')}</a></td>
            <td>${escapeHtml(accident.date || '')}</td>
            <td>${escapeHtml(accident.city || '')}</td>
            <td>${escapeHtml(accident.district || '')}</td>
            <td>${escapeHtml(accident.sector || '')}</td>
            <td>${escapeHtml(accident.cause || '')}</td>
        `;
        tbody.appendChild(row);
    });
}

// CSV Export Function
function exportToCSV() {
    if (!currentFilteredData || currentFilteredData.length === 0) {
        alert('Dışa aktarılacak veri bulunamadı.');
        return;
    }

    // Sort filtered data by date (newest first) for CSV
    const sortedData = [...currentFilteredData].sort((a, b) => {
        const dateA = parseDate(a.date);
        const dateB = parseDate(b.date);
        return dateB - dateA; // Descending order (newest first)
    });

    // CSV Headers
    const headers = ['İsim', 'Tarih', 'Şehir', 'İlçe', 'Yaş', 'Cinsiyet', 'Sektör', 'Şirket', 'Neden', 'Açıklama'];
    
    // Convert data to CSV rows
    const csvRows = [
        headers.join(','), // Header row
        ...sortedData.map(accident => {
            const row = [
                `"${(accident.person_name || 'İsimsiz İşçi').replace(/"/g, '""')}"`,
                `"${(accident.date || '').replace(/"/g, '""')}"`,
                `"${(accident.city || '').replace(/"/g, '""')}"`,
                `"${(accident.district || '').replace(/"/g, '""')}"`,
                `"${(accident.age || '').replace(/"/g, '""')}"`,
                `"${(accident.gender || '').replace(/"/g, '""')}"`,
                `"${(accident.sector || '').replace(/"/g, '""')}"`,
                `"${(accident.company || '').replace(/"/g, '""')}"`,
                `"${(accident.cause || '').replace(/"/g, '""')}"`,
                `"${(accident.details || '').replace(/"/g, '""')}"`
            ];
            return row.join(',');
        })
    ];

    // Create CSV content
    const csvContent = csvRows.join('\n');
    
    // Add BOM for Turkish characters (UTF-8)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // Generate filename with current date and filter info
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const ageMin = document.getElementById('filter-age-min').value;
    const ageMax = document.getElementById('filter-age-max').value;
    let filename = `is_cinayetleri_${dateStr}`;
    if (ageMin || ageMax) {
        filename += `_yas${ageMin || 0}-${ageMax || 'max'}`;
    }
    filename += '.csv';
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
}

// View Switching Logic
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
const mapViewBtn = document.getElementById('mapViewBtn');
const tableViewBtn = document.getElementById('tableViewBtn');
const exportBtn = document.getElementById('export-csv-btn');

if (mapViewBtn) {
    mapViewBtn.addEventListener('click', () => switchView('map'));
}
if (tableViewBtn) {
    tableViewBtn.addEventListener('click', () => switchView('table'));
}
if (exportBtn) {
    exportBtn.addEventListener('click', exportToCSV);
}

// Start
loadAccidents();
