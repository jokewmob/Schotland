const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.main-nav');

menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('open', !open);
});

nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));

const MAPBOX_TOKEN = window.SCHOTLAND_CONFIG?.mapboxToken || '';

// Subtiele aftelklok tot vertrek van de heenvlucht uit Charleroi.
const tripDeparture = new Date('2026-09-13T16:00:00+02:00');
const countdown = document.getElementById('trip-countdown');

function updateTripCountdown() {
  if (!countdown) return;
  const diff = tripDeparture.getTime() - Date.now();
  if (diff <= 0) {
    countdown.innerHTML = '<span class="countdown-label">Schotland</span><span class="countdown-time"><b>We zijn vertrokken</b></span>';
    return;
  }
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  countdown.querySelector('[data-days]').textContent = days;
  countdown.querySelector('[data-hours]').textContent = String(hours).padStart(2, '0');
  countdown.querySelector('[data-minutes]').textContent = String(minutes).padStart(2, '0');
}

updateTripCountdown();
setInterval(updateTripCountdown, 30000);

function mapsDirectionsUrl(origin, destination, waypoints = '') {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  url.searchParams.set('travelmode', 'driving');
  if (waypoints) url.searchParams.set('waypoints', waypoints);
  return url.toString();
}

function parseCoords(value) {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  return parts.length === 2 && parts.every(Number.isFinite) ? parts : null;
}

const FIXED_ROUTE_POINTS = {
  'Edinburgh Airport naar The Luib Hotel': {
    names: ['Edinburgh Airport', 'Callander', 'The Luib Hotel'],
    coords: [
      [-3.3607946, 55.9471784],
      [-4.21446, 56.24403],
      [-4.4426426, 56.4194488]
    ]
  },
  'Luib naar Carbost via Glencoe en Glenfinnan': {
    names: ['The Luib Hotel', 'Glencoe', 'Glenfinnan', 'Invergarry', 'Eilean Donan Castle', 'Carbost'],
    coords: [
      [-4.4426426, 56.4194488],
      [-5.1020, 56.6826],
      [-5.4450, 56.8712],
      [-4.8275, 57.0680],
      [-5.51605, 57.27389],
      [-6.3540, 57.3020]
    ]
  },
  'Carbost naar Old Church Inchmore via Loch Ness': {
    names: ['Carbost', 'Invergarry', 'Fort Augustus', 'Drumnadrochit', 'Old Church Inchmore'],
    coords: [
      [-6.3540, 57.3020],
      [-4.8275, 57.0680],
      [-4.6816, 57.1448],
      [-4.4790, 57.3348],
      [-4.3810, 57.4576]
    ]
  },
  'Old Church Inchmore naar Pitlochry via Cairngorms': {
    names: ['Old Church Inchmore', 'Inverness', 'Aviemore', 'Ralia Cafe', 'Birchwood Pitlochry'],
    coords: [
      [-4.3810, 57.4576],
      [-4.2247, 57.4778],
      [-3.8280, 57.1950],
      [-4.132932, 57.049697],
      [-3.72443, 56.70134]
    ]
  },
  'Pitlochry naar Edinburgh via Stirling': {
    names: ['Birchwood Pitlochry', 'Perth', 'Stirling', 'Edinburgh'],
    coords: [
      [-3.72443, 56.70134],
      [-3.4370, 56.3960],
      [-3.9369, 56.1165],
      [-3.1883, 55.9533]
    ]
  }
};

async function searchMapboxLocation(query) {
  // Alleen fallback voor toekomstige, nog niet vastgezette punten.
  const params = new URLSearchParams({
    q: query,
    country: 'GB',
    language: 'en',
    limit: '1',
    bbox: '-8.8,54.4,1.8,61.2',
    access_token: MAPBOX_TOKEN
  });

  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Mapbox Search gaf ${response.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`);
  }
  const data = await response.json();
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords)) throw new Error(`Locatie niet gevonden: ${query}`);
  return coords;
}

async function resolveRoutePoints(mapEl) {
  const { origin, destination, waypoints = '', title = '' } = mapEl.dataset;

  // Voor de reisroutes gebruiken we vaste coördinaten. Zo is er geen
  // geocoding/search-aanvraag nodig voordat Directions kan starten.
  const fixed = FIXED_ROUTE_POINTS[title];
  if (fixed) return fixed;

  const originCoords = parseCoords(mapEl.dataset.originCoords) || await searchMapboxLocation(origin);
  const destinationCoords = parseCoords(mapEl.dataset.destinationCoords) || await searchMapboxLocation(destination);
  const waypointNames = waypoints ? waypoints.split('|').map(v => v.trim()).filter(Boolean) : [];
  const waypointCoords = [];
  for (const waypoint of waypointNames) waypointCoords.push(await searchMapboxLocation(waypoint));
  return {
    names: [origin, ...waypointNames, destination],
    coords: [originCoords, ...waypointCoords, destinationCoords]
  };
}

async function fetchDrivingRoute(coords) {
  // Minimal Directions API request per Mapbox documentation.
  // Coordinates are longitude,latitude and are visited in the supplied order.
  const coordinateString = coords
    .map(([lng, lat]) => `${Number(lng).toFixed(6)},${Number(lat).toFixed(6)}`)
    .join(';');

  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinateString}`);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('access_token', MAPBOX_TOKEN);

  console.info('Mapbox Directions request:', url.toString().replace(MAPBOX_TOKEN, '[TOKEN]'));

  const response = await fetch(url.toString());
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (_) {}

  if (!response.ok) {
    const apiMessage = data?.message || data?.code || raw || `HTTP ${response.status}`;
    throw new Error(`Mapbox Directions ${response.status}: ${apiMessage}`);
  }

  if (data?.code && data.code !== 'Ok') {
    throw new Error(`Mapbox: ${data.code}${data.message ? ` — ${data.message}` : ''}`);
  }
  if (!data?.routes?.[0]?.geometry) throw new Error('Geen route gevonden.');
  return data.routes[0];
}

function addRouteMarker(map, coords, label, kind) {
  const el = document.createElement('div');
  el.className = `map-marker ${kind}`;
  el.setAttribute('aria-label', label);
  const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat(coords);
  if (label) marker.setPopup(new mapboxgl.Popup({ offset: 15, closeButton: false }).setText(label));
  marker.addTo(map);
}

async function initMapboxRoute(mapEl) {
  if (mapEl.dataset.initialized === 'true') return;

  const { origin, destination, waypoints = '', title = 'Route' } = mapEl.dataset;

  if (!navigator.onLine) {
    mapEl.dataset.initialized = 'offline';
    mapEl.innerHTML = '<div class="map-status"><div><strong>Kaart offline</strong><small>De routebeschrijving, stops en hotelinfo blijven beschikbaar. Open de kaart opnieuw zodra je verbinding hebt.</small></div></div>';
    return;
  }

  mapEl.dataset.initialized = 'true';
  const openButton = mapEl.parentElement.querySelector('.maps-open');
  if (openButton) {
    openButton.href = mapsDirectionsUrl(origin, destination, waypoints);
    openButton.setAttribute('aria-label', `${title} openen in Google Maps`);
  }

  const status = document.createElement('div');
  status.className = 'map-status';
  status.innerHTML = '<div><strong>Route laden…</strong><small>Mapbox berekent de route en past de kaart automatisch aan.</small></div>';
  mapEl.replaceChildren(status);

  if (!MAPBOX_TOKEN) {
    status.innerHTML = '<div><strong>Mapbox-token ontbreekt</strong><small>Vul je public pk.-token in assets/js/config.js in.</small></div>';
    return;
  }

  if (!window.mapboxgl) {
    status.innerHTML = '<div><strong>Kaart niet geladen</strong><small>Controleer je internetverbinding; Mapbox GL JS wordt extern geladen.</small></div>';
    return;
  }

  try {
    mapboxgl.accessToken = MAPBOX_TOKEN;
    const points = await resolveRoutePoints(mapEl);
    const route = await fetchDrivingRoute(points.coords);

    const mapContainer = document.createElement('div');
    mapContainer.className = 'mapbox-map';
    mapEl.replaceChildren(mapContainer);

    const map = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: points.coords[0],
      zoom: 7,
      attributionControl: true,
      cooperativeGestures: true
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: route.geometry }
      });

      // A subtle light casing keeps the dark Highland-green line readable on any terrain.
      map.addLayer({
        id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#f4f0e7', 'line-width': 9, 'line-opacity': .92 }
      });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#31472a', 'line-width': 5.5, 'line-opacity': .96 }
      });

      points.coords.forEach((coord, index) => {
        const kind = index === 0 ? 'start' : (index === points.coords.length - 1 ? 'finish' : 'waypoint');
        addRouteMarker(map, coord, points.names[index], kind);
      });

      const bounds = new mapboxgl.LngLatBounds();
      route.geometry.coordinates.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, { padding: { top: 48, right: 48, bottom: 48, left: 48 }, maxZoom: 11, duration: 0 });
    });
  } catch (error) {
    console.error(error);
    status.innerHTML = `<div><strong>Route niet beschikbaar</strong><small>${error.message || 'Mapbox kon deze route niet laden.'}</small></div>`;
  }
}

// Zet de Google Maps-knoppen meteen klaar, maar laad interactieve kaarten pas vlak voor ze in beeld komen.
document.querySelectorAll('.map-shell').forEach(mapEl => {
  const { origin, destination, waypoints = '', title = 'Route' } = mapEl.dataset;
  const openButton = mapEl.parentElement.querySelector('.maps-open');
  if (openButton) {
    openButton.href = mapsDirectionsUrl(origin, destination, waypoints);
    openButton.setAttribute('aria-label', `${title} openen in Google Maps`);
  }
});

const mapObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    initMapboxRoute(entry.target);
    mapObserver.unobserve(entry.target);
  });
}, { rootMargin: '350px 0px', threshold: 0.01 });

document.querySelectorAll('.map-shell').forEach(mapEl => mapObserver.observe(mapEl));

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .06 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));


// --- Tankstations via Mapbox Search Box category search ---
function googleMapsPointUrl(name, coords) {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${coords[1]},${coords[0]} (${name})`);
  return url.toString();
}

async function loadFuelStations(card) {
  if (card.dataset.loaded === 'true') return;
  const list = card.querySelector('.fuel-list');
  const lng = Number(card.dataset.fuelLng);
  const lat = Number(card.dataset.fuelLat);
  const area = card.dataset.fuelArea || 'onderweg';

  if (!navigator.onLine) {
    list.innerHTML = `<p class="fuel-error">Offline · zoek tankstations rond ${area} zodra je weer bereik hebt.</p>`;
    card.dataset.loaded = 'offline';
    return;
  }
  if (!MAPBOX_TOKEN || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    list.innerHTML = '<p class="fuel-error">Tankstations konden niet worden geladen.</p>';
    return;
  }

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      language: 'en',
      country: 'GB',
      limit: '3',
      proximity: `${lng},${lat}`
    });
    const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/category/gas_station?${params}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
    const features = data?.features || [];
    if (!features.length) throw new Error('Geen tankstations gevonden');

    list.replaceChildren(...features.slice(0, 3).map(feature => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [lng, lat];
      const item = document.createElement('div');
      item.className = 'fuel-item';
      const info = document.createElement('div');
      const name = props.name || 'Tankstation';
      const address = props.full_address || props.address || props.place_formatted || area;
      info.innerHTML = `<strong>${name}</strong><small>${address}</small>`;
      const link = document.createElement('a');
      link.href = googleMapsPointUrl(name, coords);
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Kaart ↗';
      item.append(info, link);
      return item;
    }));
    card.dataset.loaded = 'true';
  } catch (error) {
    console.warn('Tankstations:', error);
    list.innerHTML = `<p class="fuel-error">Live tankstations niet beschikbaar. Gebruik “Meer in Google Maps”.</p>`;
  }
}

const fuelObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    loadFuelStations(entry.target);
    fuelObserver.unobserve(entry.target);
  });
}, { rootMargin: '300px 0px', threshold: 0.01 });
document.querySelectorAll('.fuel-card').forEach(card => fuelObserver.observe(card));

// --- Online/offline status and retry of network features ---
function updateConnectionStatus() {
  const el = document.getElementById('connection-status');
  const offline = !navigator.onLine;
  document.body.classList.toggle('is-offline', offline);
  if (el) el.textContent = offline ? 'Offline · reisinfo blijft beschikbaar' : 'Online · offline-versie wordt bewaard';
}
updateConnectionStatus();
window.addEventListener('offline', updateConnectionStatus);
window.addEventListener('online', () => {
  updateConnectionStatus();
  document.querySelectorAll('.map-shell[data-initialized="offline"]').forEach(el => {
    el.dataset.initialized = 'false';
    initMapboxRoute(el);
  });
  document.querySelectorAll('.fuel-card[data-loaded="offline"]').forEach(card => {
    card.dataset.loaded = 'false';
    loadFuelStations(card);
  });
});

// --- PWA / offline app shell ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker:', err));
  });
}


// --- iPhone-first PWA helpers -------------------------------------------------
const tripDayTargets = [
  { start: '2026-09-13', end: '2026-09-13', target: 'dag-1', label: 'Dag 1' },
  { start: '2026-09-14', end: '2026-09-14', target: 'dag-2', label: 'Dag 2' },
  { start: '2026-09-15', end: '2026-09-15', target: 'dag-3', label: 'Dag 3' },
  { start: '2026-09-16', end: '2026-09-16', target: 'dag-4', label: 'Dag 4' },
  { start: '2026-09-17', end: '2026-09-17', target: 'dag-5', label: 'Dag 5' },
  { start: '2026-09-18', end: '2026-09-20', target: 'edinburgh', label: 'Edinburgh' },
  { start: '2026-09-21', end: '2026-09-21', target: 'terugreis', label: 'Terugreis' }
];

function isoLocalDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayTarget() {
  const today = isoLocalDate();
  const exact = tripDayTargets.find(item => today >= item.start && today <= item.end);
  if (exact) return exact;
  if (today < '2026-09-13') return tripDayTargets[0];
  return tripDayTargets.at(-1);
}

function markCurrentTripDay() {
  const current = getTodayTarget();
  document.querySelectorAll('.is-current-trip-day').forEach(el => el.classList.remove('is-current-trip-day'));
  const target = document.getElementById(current.target);
  if (target) target.classList.add('is-current-trip-day');
  document.querySelectorAll('[data-jump-today]').forEach(button => {
    button.setAttribute('aria-label', `Ga naar ${current.label}`);
  });
}

markCurrentTripDay();

document.querySelectorAll('[data-jump-today]').forEach(button => {
  button.addEventListener('click', () => {
    const current = getTodayTarget();
    document.getElementById(current.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isStandalone) document.documentElement.classList.add('is-standalone');

const pwaCard = document.getElementById('pwa-install-card');
if (isStandalone && pwaCard) {
  pwaCard.classList.add('installed');
  pwaCard.querySelector('h3').textContent = 'Schotland staat op je iPhone';
  pwaCard.querySelector('p:last-of-type').textContent = 'De app-shell en reisgegevens zijn lokaal beschikbaar. Interactieve Mapbox-kaarten en live tankstations hebben nog internet nodig.';
}

const offlineCheck = document.getElementById('offline-check');
offlineCheck?.addEventListener('click', async () => {
  offlineCheck.disabled = true;
  offlineCheck.textContent = 'Controleren…';
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (!registration?.active) throw new Error('Service worker niet actief');

    const reply = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Geen antwoord')), 2500);
      navigator.serviceWorker.addEventListener('message', function handler(event) {
        if (event.data?.type !== 'OFFLINE_STATUS') return;
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve(event.data.ready);
      });
    });

    registration.active.postMessage({ type: 'CHECK_OFFLINE' });
    const ready = await reply;
    offlineCheck.textContent = ready ? 'Offline klaar ✓' : 'Nog één keer online openen';
  } catch (_) {
    offlineCheck.textContent = navigator.onLine ? 'Herlaad de app' : 'Je bent offline';
  } finally {
    setTimeout(() => { offlineCheck.disabled = false; }, 1200);
  }
});
