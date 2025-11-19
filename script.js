// Initialize the map centered on Turkey
const map = L.map('map').setView([39.0, 35.0], 6);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Custom red marker icon for work accidents
const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Load data from JSON file
async function loadAccidents() {
    try {
        const response = await fetch('data.json');
        const workAccidents = await response.json();

        if (workAccidents.length === 0) {
            console.log('Henüz veri yok');
            return;
        }

        // Add markers to the map
        workAccidents.forEach(accident => {
            // Create popup content
            const popupContent = `
                <h3>${accident.location || 'Konum bilinmiyor'}</h3>
                <p><strong>Tarih:</strong> ${accident.date || 'Bilinmiyor'}</p>
                ${accident.company ? `<p><strong>Şirket:</strong> ${accident.company}</p>` : ''}
                <p><strong>Hayatını Kaybedenler:</strong><br>${accident.victims && accident.victims.length > 0 ? accident.victims.join('<br>') : 'Bilinmiyor'}</p>
                <p><strong>Ölüm Nedeni:</strong> ${accident.cause || 'Bilinmiyor'}</p>
                ${accident.details ? `<p><strong>Detaylar:</strong> ${accident.details}</p>` : ''}
                ${accident.sector ? `<p><strong>Sektör:</strong> ${accident.sector}</p>` : ''}
            `;

            // Add marker with popup
            L.marker(accident.coords, { icon: redIcon })
                .addTo(map)
                .bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'custom-popup'
                });
        });

        console.log(`${workAccidents.length} iş cinayeti haritaya eklendi`);

    } catch (error) {
        console.error('Veri yüklenirken hata:', error);
    }
}

// Load accidents when page loads
loadAccidents();

// Add a scale control
L.control.scale({
    metric: true,
    imperial: false
}).addTo(map);
