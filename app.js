const API = 'http://localhost:3000/shops';

const map = L.map('map').setView([-1.1025, 37.0140], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const barberIcon = L.icon({
  iconUrl: 'assets/barber.png',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -28]
});
const salonIcon = L.icon({
  iconUrl: 'assets/salon.png',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -28]
});

let allShops = [];
let markers = [];
const listingsEl = document.getElementById('listings');
const favEl = document.getElementById('favorites');
const compareCount = document.getElementById('compare-count');
const searchBox = document.getElementById('searchBox');
const filterType = document.getElementById('filterType');
const filterService = document.getElementById('filterService');
const resetBtn = document.getElementById('resetBtn');

function getFavs() {
  return JSON.parse(localStorage.getItem('kc_favs') || '[]');
}
function saveFavs(arr) {
  localStorage.setItem('kc_favs', JSON.stringify(arr));
  updateFavUI();
}
function toggleFav(id) {
  const favs = getFavs();
  if (favs.includes(id)) {
    saveFavs(favs.filter(x => x !== id));
  } else {
    favs.push(id);
    saveFavs(favs);
  }
}

// Update favorites list
function updateFavUI() {
  const favIds = getFavs();
  compareCount.textContent = favIds.length;
  favEl.innerHTML = '';
  if (!favIds.length) {
    favEl.innerHTML = '<div class="empty-msg">No favorites yet</div>';
    return;
  }

  const selected = allShops.filter(s => favIds.includes(s.id));
  selected.forEach(s => {
    const li = document.createElement('div');
    li.className = 'favorite-item';
    li.innerHTML = `
      <div>
        <div class="fav-name">${s.name}</div>
        <div class="fav-meta">${s.type} • ${s.priceRange}</div>
      </div>
      <div class="fav-actions">
        <button class="btn-view" onclick="zoomTo(${s.coords.lat},${s.coords.lng})">View</button>
        <button class="btn-remove" onclick="toggleFav(${s.id})">Remove</button>
      </div>
    `;
    favEl.appendChild(li);
  });
}

function zoomTo(lat, lng) {
  map.setView([lat, lng], 17, { animate: true });
}

function buildServiceOptions(shops) {
  const set = new Set();
  shops.forEach(s => (s.services || []).forEach(x => set.add(x)));
  filterService.innerHTML = `<option value="all">All services</option>`;
  Array.from(set).sort().forEach(sv => {
    const o = document.createElement('option');
    o.value = sv;
    o.textContent = sv;
    filterService.appendChild(o);
  });
}

function shopPopupHTML(s) {
  return `
    <div class="popup-card">
      <h6>${s.name}</h6>
      <div class="popup-meta">${s.type} • ${s.priceRange}</div>
      <div><strong>Services:</strong> ${s.services.join(', ')}</div>
      <div><strong>Rating:</strong> ⭐ ${s.rating} ${s.discount ? '• ' + s.discount : ''}</div>
      <div class="popup-contacts">${s.contacts}</div>
      <div class="popup-actions">
        <button class="btn-add add-compare">Add to favorites</button>
        <button class="btn-zoom view-zoom">Zoom</button>
      </div>
    </div>
  `;
}

// Render markers and listing cards
function render(shops) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  listingsEl.innerHTML = '';

  shops.forEach(s => {
    const icon = s.type === 'barber' ? barberIcon : salonIcon;

    const marker = L.marker([s.coords.lat, s.coords.lng], { icon }).addTo(map);
    marker.bindPopup(shopPopupHTML(s));
    marker.on('popupopen', (e) => {
      const p = e.popup.getElement();
      const addBtn = p.querySelector('.add-compare');
      const zoomBtn = p.querySelector('.view-zoom');
      if (addBtn) addBtn.onclick = () => toggleFav(s.id);
      if (zoomBtn) zoomBtn.onclick = () => map.setView([s.coords.lat, s.coords.lng], 17);
    });

    markers.push(marker);

    // listing card
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.innerHTML = `
      <div class="listing-header">
        <h6>${s.name}</h6>
        <span class="listing-rating">⭐ ${s.rating}</span>
      </div>
      <p class="listing-meta">${s.type} • ${s.priceRange}</p>
      <div class="listing-actions">
        <button class="btn-view">View</button>
        <button class="btn-compare">Compare</button>
      </div>
    `;
    
    // view button
    card.querySelector('.btn-view').addEventListener('click', () => {
      map.setView([s.coords.lat, s.coords.lng], 17, { animate: true });
      marker.openPopup();
    });
    // compare button
    card.querySelector('.btn-compare').addEventListener('click', () => {
      toggleFav(s.id);
    });

    listingsEl.appendChild(card);
  });
}

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('kc_user'); 
  window.location.href = "signup.html";
});

async function init() {
  try {
    const res = await fetch(API);
    allShops = await res.json();
    render(allShops);
    buildServiceOptions(allShops);
    updateFavUI();

    const params = new URLSearchParams(location.search);
    const qlat = params.get('lat'), qlng = params.get('lng');
    if (qlat && qlng) {
      map.setView([parseFloat(qlat), parseFloat(qlng)], parseInt(params.get('z') || 17));
    }
  } catch (err) {
    console.error('Failed to load shops:', err);
    listingsEl.innerHTML = '<div class="error">Failed to load data. Is json-server running?</div>';
  }
}

// Filters
searchBox?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  applyFilters(q, filterType.value, filterService.value);
});
filterType?.addEventListener('change', () => applyFilters(searchBox.value.trim().toLowerCase(), filterType.value, filterService.value));
filterService?.addEventListener('change', () => applyFilters(searchBox.value.trim().toLowerCase(), filterType.value, filterService.value));
resetBtn?.addEventListener('click', () => {
  searchBox.value = '';
  filterType.value = 'all';
  filterService.value = 'all';
  render(allShops);
});

function applyFilters(q = '', type = 'all', service = 'all') {
  let filtered = allShops.slice();
  if (type !== 'all') filtered = filtered.filter(s => s.type === type);
  if (service !== 'all') filtered = filtered.filter(s => (s.services || []).some(x => x.toLowerCase() === service.toLowerCase()));
  if (q) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.services || []).some(x => x.toLowerCase().includes(q))
    );
  }
  render(filtered);
}

// Clear favorites
document.getElementById('clearFavorites')?.addEventListener('click', () => {
  if (!confirm('Clear favorites?')) return;
  saveFavs([]);
});

init();

window.toggleFav = toggleFav;
window.zoomTo = zoomTo;
