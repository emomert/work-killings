// Initialize map
let map;
const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

async function loadProfile() {
    // Get ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (!id) {
        showError('Kayıt bulunamadı (ID eksik).');
        return;
    }

    try {
        // Fetch data
        const response = await fetch(`data.json?ts=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();

        // Find record
        const record = data.find(item => item.id === id);

        if (!record) {
            showError('Kayıt bulunamadı.');
            return;
        }

        renderProfile(record);

    } catch (error) {
        console.error('Hata:', error);
        showError('Veri yüklenirken bir hata oluştu.');
    }
}

function renderProfile(record) {
    // Hide loading, show content
    document.getElementById('loading').style.display = 'none';
    document.getElementById('profile-content').style.display = 'block';

    // Update title
    const victims = record.person_name || 'İsimsiz İşçi';
    document.title = `${victims} - Türkiye İş Cinayetleri Haritası`;

    // Handle Image
    const imageContainer = document.getElementById('image-container');
    const victimImage = document.getElementById('victim-image');

    if (record.image) {
        victimImage.src = record.image;
        imageContainer.style.display = 'flex';
    } else {
        imageContainer.style.display = 'none';
    }

    // Fill fields
    document.getElementById('victim-name').textContent = victims;
    document.getElementById('incident-date').textContent = formatDate(record.date) || '-';
    document.getElementById('incident-city').textContent = record.city || '-';
    document.getElementById('incident-district').textContent = record.district || '-';
    // Age display supports ranges
    document.getElementById('incident-age').textContent = record.age || '-';
    document.getElementById('incident-gender').textContent = record.gender || '-';
    document.getElementById('incident-sector').textContent = record.sector || '-';
    document.getElementById('incident-company').textContent = record.company || 'Belirtilmemiş';
    document.getElementById('incident-cause').textContent = record.cause || '-';
    document.getElementById('incident-details').textContent = record.details || '-';

    // Source tweet link
    const sourceRow = document.getElementById('source-row');
    const sourceLink = document.getElementById('source-tweet');
    if (record.tweetUrl) {
        sourceLink.href = record.tweetUrl;
        sourceRow.style.display = 'flex';
    } else {
        sourceRow.style.display = 'none';
    }

    const multiBadge = document.getElementById('multi-badge');
    if (record.multi_victim) {
        multiBadge.style.display = 'inline-block';
    } else {
        multiBadge.style.display = 'none';
    }

    // Render Messages
    const memorialContent = document.querySelector('.memorial-content');
    memorialContent.innerHTML = ''; // Clear placeholder

    if (record.messages && record.messages.length > 0) {
        record.messages.forEach(msg => {
            const messageCard = document.createElement('div');
            messageCard.className = 'message-card';
            messageCard.innerHTML = `
                <div class="message-header">
                    <span class="message-author">${msg.name}</span>
                    <span class="message-date">${msg.date}</span>
                </div>
                <p class="message-text">${msg.text}</p>
            `;
            memorialContent.appendChild(messageCard);
        });
    } else {
        memorialContent.innerHTML = '<p class="placeholder-text">Henüz bir mesaj eklenmemiş.</p>';
    }

    // Initialize mini map
    if (record.coords) {
        map = L.map('mini-map').setView(record.coords, 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        L.marker(record.coords, { icon: redIcon }).addTo(map);
    }
}

function formatDate(dateString) {
    if (!dateString) return null;

    const months = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    const parts = dateString.split('.');
    if (parts.length !== 3) return dateString;

    const day = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[2];

    if (monthIndex >= 0 && monthIndex < 12) {
        return `${day} ${months[monthIndex]} ${year}`;
    }

    return dateString;
}

function showError(message) {
    document.getElementById('loading').textContent = message;
    document.getElementById('loading').style.color = '#c41e3a';
}

// Start
loadProfile();
