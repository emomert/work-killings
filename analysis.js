// Global data
let allData = [];
let choroplethMap = null;
let geoJsonLayer = null;
let selectedYear = '2025'; // Default year filter

// Sector options
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

// Turkish month names
const TURKISH_MONTHS = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Age groups
const AGE_GROUPS = [
    { label: '0-18 (Çocuk)', min: 0, max: 17 },
    { label: '18-25', min: 18, max: 24 },
    { label: '25-35', min: 25, max: 34 },
    { label: '35-45', min: 35, max: 44 },
    { label: '45-55', min: 45, max: 54 },
    { label: '55+', min: 55, max: 150 }
];

// Chart instances
let monthlyChart = null;
let sectorChart = null;
let ageChart = null;
let yearlyChart = null;

// Load data
async function loadData() {
    try {
        const response = await fetch(`data.json?ts=${Date.now()}`, { cache: 'no-store' });
        allData = await response.json();

        // Populate sector dropdowns
        populateSectorDropdowns();

        // Initialize charts
        initMonthlyChart();
        initSectorChart();
        initAgeChart();
        initYearlyChart();
        initChoroplethMap();

        // Add event listeners
        setupEventListeners();

        console.log(`${allData.length} kayıt yüklendi`);
    } catch (error) {
        console.error('Veri yüklenirken hata:', error);
    }
}

// Populate sector dropdowns
function populateSectorDropdowns() {
    const dropdowns = ['monthly-sector', 'age-sector', 'map-sector', 'yearly-sector'];
    dropdowns.forEach(id => {
        const select = document.getElementById(id);
        SECTOR_OPTIONS.forEach(sector => {
            const option = document.createElement('option');
            option.value = sector;
            option.textContent = sector;
            select.appendChild(option);
        });
    });
}

// Parse date (DD.MM.YYYY format)
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
    }
    return null;
}

// Get age from record (unknown = 25, above 18)
function getAge(record) {
    if (typeof record.age_min === 'number') return record.age_min;
    if (typeof record.age_max === 'number') return record.age_max;
    if (typeof record.age === 'number') return record.age;
    // Unknown age = treat as adult (25)
    return 25;
}

// Filter data based on filters
function filterData(data, genderId, sectorId, dateStartId, dateEndId) {
    const gender = document.getElementById(genderId)?.value || '';
    const sector = document.getElementById(sectorId)?.value || '';
    const dateStart = document.getElementById(dateStartId)?.value || '';
    const dateEnd = document.getElementById(dateEndId)?.value || '';

    const startDate = dateStart ? new Date(dateStart) : null;
    const endDate = dateEnd ? new Date(dateEnd) : null;

    return data.filter(item => {
        // Year filter from header buttons
        if (selectedYear !== 'all') {
            const itemDate = parseDate(item.date);
            if (!itemDate) return false;
            if (itemDate.getFullYear().toString() !== selectedYear) return false;
        }

        if (gender && item.gender !== gender) return false;
        if (sector && item.sector !== sector) return false;

        if (startDate || endDate) {
            const itemDate = parseDate(item.date);
            if (!itemDate) return false;
            if (startDate && itemDate < startDate) return false;
            if (endDate && itemDate > endDate) return false;
        }

        return true;
    });
}

// =====================
// MONTHLY CHART
// =====================
function initMonthlyChart() {
    const ctx = document.getElementById('monthlyChart').getContext('2d');

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'İş Cinayeti Sayısı',
                data: [],
                backgroundColor: 'rgba(196, 30, 58, 0.7)',
                borderColor: '#c41e3a',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#b0b0b0', maxRotation: 45 },
                    grid: { display: false }
                }
            }
        }
    });

    updateMonthlyChart();
}

function updateMonthlyChart() {
    const filtered = filterData(allData, 'monthly-gender', 'monthly-sector', 'monthly-date-start', 'monthly-date-end');

    // Group by month
    const monthCounts = {};
    filtered.forEach(item => {
        const date = parseDate(item.date);
        if (date) {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[key] = (monthCounts[key] || 0) + 1;
        }
    });

    // Sort by date
    const sortedKeys = Object.keys(monthCounts).sort();

    // Format labels
    const labels = sortedKeys.map(key => {
        const [year, month] = key.split('-');
        return `${TURKISH_MONTHS[parseInt(month) - 1]} ${year}`;
    });

    monthlyChart.data.labels = labels;
    monthlyChart.data.datasets[0].data = sortedKeys.map(k => monthCounts[k]);
    monthlyChart.update();
}

// =====================
// SECTOR PIE CHART
// =====================
function initSectorChart() {
    const ctx = document.getElementById('sectorChart').getContext('2d');

    const colors = [
        '#c41e3a', '#e74c3c', '#f39c12', '#27ae60', '#3498db',
        '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71', '#8e44ad',
        '#16a085'
    ];

    sectorChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: colors,
                borderColor: '#2d2d2d',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#b0b0b0',
                        font: { size: 11 },
                        padding: 10
                    }
                }
            }
        }
    });

    updateSectorChart();
}

function updateSectorChart() {
    const filtered = filterData(allData, 'sector-gender', null, 'sector-date-start', 'sector-date-end');

    // Group by sector
    const sectorCounts = {};
    filtered.forEach(item => {
        const sector = item.sector || 'Bilinmiyor';
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
    });

    // Sort by count
    const sorted = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]);

    sectorChart.data.labels = sorted.map(s => s[0]);
    sectorChart.data.datasets[0].data = sorted.map(s => s[1]);
    sectorChart.update();
}

// =====================
// AGE GROUPS CHART
// =====================
function initAgeChart() {
    const ctx = document.getElementById('ageChart').getContext('2d');

    ageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: AGE_GROUPS.map(g => g.label),
            datasets: [{
                label: 'Kişi Sayısı',
                data: [],
                backgroundColor: [
                    'rgba(52, 152, 219, 0.7)',  // Blue for children
                    'rgba(196, 30, 58, 0.7)',
                    'rgba(196, 30, 58, 0.7)',
                    'rgba(196, 30, 58, 0.7)',
                    'rgba(196, 30, 58, 0.7)',
                    'rgba(196, 30, 58, 0.7)'
                ],
                borderColor: [
                    '#3498db',
                    '#c41e3a',
                    '#c41e3a',
                    '#c41e3a',
                    '#c41e3a',
                    '#c41e3a'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#b0b0b0' },
                    grid: { display: false }
                }
            }
        }
    });

    updateAgeChart();
}

function updateAgeChart() {
    const filtered = filterData(allData, 'age-gender', 'age-sector', 'age-date-start', 'age-date-end');

    // Group by age groups
    const groupCounts = AGE_GROUPS.map(() => 0);

    filtered.forEach(item => {
        const age = getAge(item);
        for (let i = 0; i < AGE_GROUPS.length; i++) {
            if (age >= AGE_GROUPS[i].min && age <= AGE_GROUPS[i].max) {
                groupCounts[i]++;
                break;
            }
        }
    });

    ageChart.data.datasets[0].data = groupCounts;
    ageChart.update();
}

// =====================
// YEARLY COMPARISON CHART
// =====================
function initYearlyChart() {
    const ctx = document.getElementById('yearlyChart').getContext('2d');

    yearlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: TURKISH_MONTHS,
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#b0b0b0',
                        font: { size: 12 },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#b0b0b0' },
                    grid: { color: 'rgba(255,255,255,0.1)' }
                },
                x: {
                    ticks: { color: '#b0b0b0' },
                    grid: { display: false }
                }
            }
        }
    });

    updateYearlyChart();
}

function updateYearlyChart() {
    // This chart ignores the selectedYear filter - shows all years
    const gender = document.getElementById('yearly-gender')?.value || '';
    const sector = document.getElementById('yearly-sector')?.value || '';

    // Filter data (without year filter)
    const filtered = allData.filter(item => {
        if (gender && item.gender !== gender) return false;
        if (sector && item.sector !== sector) return false;
        return true;
    });

    // Group by year and month
    const yearMonthCounts = {};

    filtered.forEach(item => {
        const date = parseDate(item.date);
        if (date) {
            const year = date.getFullYear();
            const month = date.getMonth(); // 0-11

            if (!yearMonthCounts[year]) {
                yearMonthCounts[year] = new Array(12).fill(0);
            }
            yearMonthCounts[year][month]++;
        }
    });

    // Get years and sort them
    const years = Object.keys(yearMonthCounts).sort();

    // Color palette for years
    const yearColors = {
        '2023': { bg: 'rgba(155, 89, 182, 0.2)', border: '#9b59b6' },
        '2024': { bg: 'rgba(52, 152, 219, 0.2)', border: '#3498db' },
        '2025': { bg: 'rgba(196, 30, 58, 0.2)', border: '#c41e3a' }
    };

    // Create datasets for each year
    const datasets = years.map(year => {
        const colors = yearColors[year] || { bg: 'rgba(149, 165, 166, 0.2)', border: '#95a5a6' };
        return {
            label: year,
            data: yearMonthCounts[year],
            borderColor: colors.border,
            backgroundColor: colors.bg,
            tension: 0.3,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6
        };
    });

    yearlyChart.data.datasets = datasets;
    yearlyChart.update();
}

// =====================
// CHOROPLETH MAP
// =====================
function initChoroplethMap() {
    choroplethMap = L.map('choropleth-map').setView([39.0, 35.0], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(choroplethMap);

    // Load Turkey GeoJSON
    loadTurkeyGeoJSON();
}

async function loadTurkeyGeoJSON() {
    try {
        // Use a public Turkey provinces GeoJSON
        const response = await fetch('https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json');
        const geoData = await response.json();

        updateChoroplethMap(geoData);
    } catch (error) {
        console.error('GeoJSON yüklenirken hata:', error);
    }
}

function updateChoroplethMap(geoData) {
    const filtered = filterData(allData, 'map-gender', 'map-sector', 'map-date-start', 'map-date-end');

    // Count by city
    const cityCounts = {};
    filtered.forEach(item => {
        if (item.city) {
            const city = item.city.trim();
            cityCounts[city] = (cityCounts[city] || 0) + 1;
        }
    });

    // Find max for color scaling
    const maxCount = Math.max(...Object.values(cityCounts), 1);

    // Remove existing layer
    if (geoJsonLayer) {
        choroplethMap.removeLayer(geoJsonLayer);
    }

    // Create new layer
    geoJsonLayer = L.geoJSON(geoData, {
        style: function (feature) {
            const cityName = feature.properties.name || feature.properties.NAME_1;
            const count = cityCounts[cityName] || 0;

            return {
                fillColor: getColor(count, maxCount),
                weight: 1,
                opacity: 1,
                color: '#444',
                fillOpacity: 0.7
            };
        },
        onEachFeature: function (feature, layer) {
            const cityName = feature.properties.name || feature.properties.NAME_1;
            const count = cityCounts[cityName] || 0;

            layer.bindTooltip(`<div class="info-popup"><strong>${cityName}</strong><br>${count} iş cinayeti</div>`, {
                permanent: false,
                direction: 'auto'
            });

            layer.on({
                mouseover: function (e) {
                    e.target.setStyle({ weight: 3, color: '#c41e3a' });
                },
                mouseout: function (e) {
                    geoJsonLayer.resetStyle(e.target);
                }
            });
        }
    }).addTo(choroplethMap);

    // Update legend
    updateMapLegend(maxCount);
}

function getColor(count, max) {
    if (count === 0) return '#2d2d2d';

    const ratio = count / max;

    if (ratio > 0.8) return '#7f0000';
    if (ratio > 0.6) return '#b71c1c';
    if (ratio > 0.4) return '#c62828';
    if (ratio > 0.2) return '#e53935';
    if (ratio > 0.1) return '#ef5350';
    return '#ef9a9a';
}

function updateMapLegend(max) {
    const legend = document.getElementById('map-legend');
    const ranges = [
        { color: '#2d2d2d', label: '0' },
        { color: '#ef9a9a', label: `1-${Math.floor(max * 0.1)}` },
        { color: '#ef5350', label: `${Math.floor(max * 0.1) + 1}-${Math.floor(max * 0.2)}` },
        { color: '#e53935', label: `${Math.floor(max * 0.2) + 1}-${Math.floor(max * 0.4)}` },
        { color: '#c62828', label: `${Math.floor(max * 0.4) + 1}-${Math.floor(max * 0.6)}` },
        { color: '#b71c1c', label: `${Math.floor(max * 0.6) + 1}-${Math.floor(max * 0.8)}` },
        { color: '#7f0000', label: `${Math.floor(max * 0.8) + 1}+` }
    ];

    legend.innerHTML = ranges.map(r => `
        <div class="legend-item">
            <div class="legend-color" style="background: ${r.color}"></div>
            <span>${r.label}</span>
        </div>
    `).join('');
}

// =====================
// EVENT LISTENERS
// =====================
function setupEventListeners() {
    // Monthly chart filters
    ['monthly-gender', 'monthly-sector', 'monthly-date-start', 'monthly-date-end'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateMonthlyChart);
    });

    // Sector chart filters
    ['sector-gender', 'sector-date-start', 'sector-date-end'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateSectorChart);
    });

    // Age chart filters
    ['age-gender', 'age-sector', 'age-date-start', 'age-date-end'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateAgeChart);
    });

    // Map filters
    ['map-gender', 'map-sector', 'map-date-start', 'map-date-end'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            loadTurkeyGeoJSON();
        });
    });

    // Yearly comparison chart filters (not affected by year buttons)
    ['yearly-gender', 'yearly-sector'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateYearlyChart);
    });

    // Year filter buttons
    document.querySelectorAll('.year-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedYear = btn.dataset.year;

            // Update button styles
            document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update all charts
            updateAllCharts();
        });
    });
}

// Update all charts
function updateAllCharts() {
    updateMonthlyChart();
    updateSectorChart();
    updateAgeChart();
    loadTurkeyGeoJSON();
}

// Start
loadData();
