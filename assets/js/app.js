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

async function searchMapboxLocation(query) {
  const params = new URLSearchParams({
    q: query,
    country: 'GB',
    language: 'en',
    limit: '1',
    bbox: '-8.8,54.4,1.8,61.2',
    access_token: MAPBOX_TOKEN
  });

  // Search Box includes POIs such as hotels and sights.
  let response = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${params}`);
  if (response.ok) {
    const data = await response.json();
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords)) return coords;
  }

  // Address/place fallback through Geocoding v6.
  response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
  if (!response.ok) throw new Error(`Locatie niet gevonden: ${query}`);
  const data = await response.json();
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!Array.isArray(coords)) throw new Error(`Locatie niet gevonden: ${query}`);
  return coords;
}

async function resolveRoutePoints(mapEl) {
  const { origin, destination, waypoints = '' } = mapEl.dataset;
  const originCoords = parseCoords(mapEl.dataset.originCoords) || await searchMapboxLocation(origin);
  const destinationCoords = parseCoords(mapEl.dataset.destinationCoords) || await searchMapboxLocation(destination);
  const waypointNames = waypoints ? waypoints.split('|').map(v => v.trim()).filter(Boolean) : [];
  const waypointCoords = [];
  for (const waypoint of waypointNames) waypointCoords.push(await searchMapboxLocation(waypoint));
  return {
    names: [origin, ...waypointNames, destination],
    coords: [originCoords, ...waypointCoords, destination]
  };
}

async function fetchDrivingRoute(coords) {
  const coordinateString = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const params = new URLSearchParams({
    alternatives: 'false',
    geometries: 'geojson',
    overview: 'full',
    steps: 'false',
    access_token: MAPBOX_TOKEN
  });
  const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinateString}?${params}`);
  if (!response.ok) throw new Error('Route kon niet worden berekend.');
  const data = await response.json();
  if (!data.routes?.[0]?.geometry) throw new Error('Geen route gevonden.');
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
  mapEl.dataset.initialized = 'true';

  const { origin, destination, waypoints = '', title = 'Route' } = mapEl.dataset;
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
