/* ===========================================================
   WebGIS Studio — Main Application Script
   =========================================================== */

const APP_VERSION = '2.1.0';
const APP_NAME = 'WebGIS';
console.log(`%c${APP_NAME} v${APP_VERSION}`, 'font-weight:600;color:#24529A;');

const COLORS = ['#24529A', '#D87822', '#3E745A', '#5D78A4', '#B88A2A', '#B34F4A', '#7EA8F2'];
let colorIdx = 0;
function nextColor() { return COLORS[(colorIdx++) % COLORS.length]; }

const ICON_EYE_OPEN = '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const ICON_EYE_CLOSED = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.1A11 11 0 0 1 12 5c7 0 11 7 11 7a13.5 13.5 0 0 1-3.1 3.8M6.6 6.6A13.4 13.4 0 0 0 1 12s4 7 11 7a10.4 10.4 0 0 0 5.4-1.5"/></svg>';
const ICON_ZOOM = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>';
const ICON_DELETE = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M6 18L18 6"/></svg>';
const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';

const state = {
  layers: [],
  rasterLayers: [],
  activeLayerId: null,
  selectedFeatureId: null,
  isTableVisible: false,
  currentDrawMode: null,
  isEditModeActive: false,
  basemapKey: 'light'
};

const els = {
  mapWrap: document.getElementById('mapWrap'),
  openFileBtn: document.getElementById('openFileBtn'),
  fileInput: document.getElementById('fileInput'),
  cameraInput: document.getElementById('cameraInput'),
  loadStatus: document.getElementById('loadStatus'),
  basemapSelect: document.getElementById('basemapSelect'),
  layerList: document.getElementById('layerList'),
  newLayerBtn: document.getElementById('newLayerBtn'),
  drawToolbar: document.getElementById('drawToolbar'),
  stylePanel: document.getElementById('stylePanel'),
  styleEmptyState: document.getElementById('styleEmptyState'),
  stylePointColor: document.getElementById('stylePointColor'),
  styleLineColor: document.getElementById('styleLineColor'),
  styleFillColor: document.getElementById('styleFillColor'),
  styleWidth: document.getElementById('styleWidth'),
  styleOpacity: document.getElementById('styleOpacity'),
  labelField: document.getElementById('labelField'),
  printPdfBtn: document.getElementById('printPdfBtn'),
  toggleTableBtn: document.getElementById('toggleTableBtn'),
  tablePanel: document.getElementById('tablePanel'),
  tableTitle: document.getElementById('tableTitle'),
  attrTable: document.getElementById('attrTable'),
  closeTableBtn: document.getElementById('closeTableBtn'),
  addFieldBtn: document.getElementById('addFieldBtn'),
  drawPointBtn: document.getElementById('drawPointBtn'),
  drawLineBtn: document.getElementById('drawLineBtn'),
  drawPolyBtn: document.getElementById('drawPolyBtn'),
  trashBtn: document.getElementById('trashBtn'),
  gpsLocateBtn: document.getElementById('gpsLocateBtn'),
  recordGpsBtn: document.getElementById('recordGpsBtn'),
  bufferBtn: document.getElementById('bufferBtn'),
  clipBtn: document.getElementById('clipBtn'),
  clipMaskSelect: document.getElementById('clipMaskSelect'),
  rasterLayerList: document.getElementById('rasterLayerList'),
  saveProjectBtn: document.getElementById('saveProjectBtn'),
  openProjectBtn: document.getElementById('openProjectBtn'),
  projectInput: document.getElementById('projectInput'),
  mobileMenuToggle: document.getElementById('mobileMenuToggle'),
  sidebar: document.getElementById('sidebar'),
  themeToggle: document.getElementById('themeToggle'),
  statusCoords: document.getElementById('statusCoords'),
  statusZoom: document.getElementById('statusZoom'),
  statusLayerCount: document.getElementById('statusLayerCount'),
  toastRoot: document.getElementById('toastRoot'),
};

/* -----------------------------------------------------------
   Theme (light / dark) — required by the visual style system
----------------------------------------------------------- */
function initTheme() {
  const saved = null; // artifacts must not use localStorage; session-only preference
  const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
  els.themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
}
els.themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  els.themeToggle.setAttribute('aria-pressed', next === 'light' ? 'true' : 'false');
});
initTheme();

/* -----------------------------------------------------------
   Sidebar tabs
----------------------------------------------------------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('is-active'));
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected', 'true');
    document.querySelector(`.tab-panel[data-tab-panel="${btn.dataset.tab}"]`).classList.add('is-active');
  });
});
function switchToTab(tabName) {
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.click();
}

/* -----------------------------------------------------------
   Toasts — non-blocking status feedback
----------------------------------------------------------- */
function toast(message, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ` ${kind}` : '');
  el.textContent = message;
  els.toastRoot.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function setStatus(msg, kind) {
  els.loadStatus.textContent = msg || '';
  els.loadStatus.className = 'status' + (kind ? ' ' + kind : '');
  if (msg && kind) toast(msg, kind);
}

/* -----------------------------------------------------------
   Modal system — replaces native alert() / confirm() / prompt()
   Native dialogs block the main thread, cannot be themed, and
   break dark mode; this keeps the UI responsive and on-brand.
----------------------------------------------------------- */
const modalRoot = document.getElementById('modalRoot');
const modalScrim = document.getElementById('modalScrim');
const modalDialog = document.getElementById('modalDialog');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalFieldWrap = document.getElementById('modalFieldWrap');
const modalField = document.getElementById('modalField');
const modalActions = document.getElementById('modalActions');

function openModal({ title, message, withField = false, fieldValue = '', fieldPlaceholder = '', confirmLabel = 'OK', cancelLabel = null, danger = false }) {
  return new Promise(resolve => {
    modalTitle.textContent = title || '';
    modalMessage.textContent = message || '';
    modalMessage.hidden = !message;
    modalFieldWrap.hidden = !withField;
    modalField.value = fieldValue;
    modalField.placeholder = fieldPlaceholder;
    modalActions.innerHTML = '';

    const finish = (value) => { modalRoot.hidden = true; document.removeEventListener('keydown', onKey); resolve(value); };

    if (cancelLabel !== null) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'tool';
      cancelBtn.textContent = cancelLabel || 'Cancel';
      cancelBtn.addEventListener('click', () => finish(withField ? null : false));
      modalActions.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'tool primary' + (danger ? ' is-danger' : '');
    confirmBtn.textContent = confirmLabel;
    confirmBtn.addEventListener('click', () => finish(withField ? modalField.value : true));
    modalActions.appendChild(confirmBtn);

    function onKey(e) {
      if (e.key === 'Escape' && cancelLabel !== null) finish(withField ? null : false);
      if (e.key === 'Enter' && withField) finish(modalField.value);
    }
    document.addEventListener('keydown', onKey);

    modalRoot.hidden = false;
    (withField ? modalField : confirmBtn).focus();
  });
}
modalScrim.addEventListener('click', () => { modalRoot.hidden = true; });

/* -----------------------------------------------------------
   Photo lightbox — in-page full-size viewer for popup thumbnails.
   Replaces window.open(dataURL): several mobile browsers (iOS Safari
   in particular) refuse to navigate a new tab to a data: URL and
   just show a blank page, which is what was happening before.
----------------------------------------------------------- */
const lightboxRoot = document.getElementById('lightboxRoot');
const lightboxImg = document.getElementById('lightboxImg');
function openImageLightbox(url) { lightboxImg.src = url; lightboxRoot.hidden = false; }
function closeImageLightbox() { lightboxRoot.hidden = true; lightboxImg.src = ''; }
document.getElementById('lightboxScrim').addEventListener('click', closeImageLightbox);
lightboxImg.addEventListener('click', closeImageLightbox);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightboxRoot.hidden) closeImageLightbox(); });

const modalConfirm = (title, message, opts = {}) => openModal({ title, message, confirmLabel: opts.confirmLabel || 'Confirm', cancelLabel: opts.cancelLabel || 'Cancel', danger: opts.danger });
const modalPrompt = (title, message, fieldValue = '', opts = {}) => openModal({ title, message, withField: true, fieldValue, fieldPlaceholder: opts.placeholder || '', confirmLabel: opts.confirmLabel || 'OK', cancelLabel: 'Cancel' });
const modalAlert = (title, message) => openModal({ title, message, confirmLabel: 'OK', cancelLabel: null });

/* -----------------------------------------------------------
   Mobile sidebar drawer
----------------------------------------------------------- */
if (els.mobileMenuToggle && els.sidebar) {
  els.mobileMenuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    els.sidebar.classList.toggle('mobile-open');
  });
  els.mapWrap.addEventListener('click', () => {
    if (window.innerWidth <= 900 && els.sidebar.classList.contains('mobile-open')) {
      els.sidebar.classList.remove('mobile-open');
    }
  });
}

/* -----------------------------------------------------------
   Sidebar resize (desktop) — drag the handle on the right edge.
   Disabled on mobile via CSS (the sidebar is a drawer there instead).
----------------------------------------------------------- */
const sidebarResizer = document.getElementById('sidebarResizer');
if (sidebarResizer) {
  let resizing = false;
  sidebarResizer.addEventListener('pointerdown', (e) => {
    if (window.innerWidth <= 900) return;
    resizing = true;
    sidebarResizer.classList.add('is-dragging');
    sidebarResizer.setPointerCapture(e.pointerId);
  });
  sidebarResizer.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    const width = Math.min(560, Math.max(220, e.clientX));
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    map.resize();
  });
  const stopResizing = () => { resizing = false; sidebarResizer.classList.remove('is-dragging'); };
  sidebarResizer.addEventListener('pointerup', stopResizing);
  sidebarResizer.addEventListener('pointercancel', stopResizing);
}

/* -----------------------------------------------------------
   Basemaps
----------------------------------------------------------- */
const BASEMAPS = {
  light: { tiles: ['a', 'b', 'c', 'd'].map(s => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`), attribution: '&copy; CARTO' },
  dark: { tiles: ['a', 'b', 'c', 'd'].map(s => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`), attribution: '&copy; CARTO' },
  streets: { tiles: ['a', 'b', 'c'].map(s => `https://${s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), attribution: '&copy; OSM' },
  physical: { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}'], attribution: 'Esri' },
  satellite: { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'Esri' },
};

function switchBasemap(key) {
  const cfg = BASEMAPS[key];
  if (!cfg) return;

  const style = map.getStyle();
  const anchor = style?.layers?.find(l => l.id !== 'basemap-layer');

  if (map.getLayer('basemap-layer')) map.removeLayer('basemap-layer');
  if (map.getSource('basemap-source')) map.removeSource('basemap-source');

  map.addSource('basemap-source', { type: 'raster', tiles: cfg.tiles, tileSize: 256, attribution: cfg.attribution });
  map.addLayer({ id: 'basemap-layer', type: 'raster', source: 'basemap-source' }, anchor ? anchor.id : undefined);

  state.basemapKey = key;
  if (els.basemapSelect) els.basemapSelect.value = key;
}
if (els.basemapSelect) els.basemapSelect.addEventListener('change', (e) => switchBasemap(e.target.value));

/* -----------------------------------------------------------
   Map init
----------------------------------------------------------- */
const map = new maplibregl.Map({
  container: 'map',
  style: { version: 8, glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf', sources: {}, layers: [] },
  center: [122.5, -20.5],
  zoom: 4,
  preserveDrawingBuffer: true
});
map.addControl(new maplibregl.NavigationControl(), 'top-right');

/* Status bar: coordinates, zoom, layer count — throttled via rAF */
let statusRaf = null;
function updateStatusBar(lngLat) {
  if (statusRaf) return;
  statusRaf = requestAnimationFrame(() => {
    if (lngLat) els.statusCoords.textContent = `${lngLat.lng.toFixed(5)}, ${lngLat.lat.toFixed(5)}`;
    els.statusZoom.textContent = `z ${map.getZoom().toFixed(2)}`;
    statusRaf = null;
  });
}
map.on('mousemove', (e) => updateStatusBar(e.lngLat));
map.on('move', () => updateStatusBar());
map.on('load', () => { switchBasemap('light'); updateStatusBar(map.getCenter()); });

const customDrawStyles = [
  { 'id': 'gl-draw-polygon-fill-inactive', 'type': 'fill', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], 'paint': { 'fill-color': '#24529A', 'fill-outline-color': '#24529A', 'fill-opacity': 0.12 } },
  { 'id': 'gl-draw-polygon-fill-active', 'type': 'fill', 'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']], 'paint': { 'fill-color': '#D87822', 'fill-outline-color': '#D87822', 'fill-opacity': 0.18 } },
  { 'id': 'gl-draw-polygon-midpoint', 'type': 'circle', 'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], 'paint': { 'circle-radius': 5, 'circle-color': '#D87822' } },
  { 'id': 'gl-draw-polygon-stroke-inactive', 'type': 'line', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#24529A', 'line-width': 2 } },
  { 'id': 'gl-draw-polygon-stroke-active', 'type': 'line', 'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#D87822', 'line-dasharray': [0.2, 2], 'line-width': 2 } },
  { 'id': 'gl-draw-line-inactive', 'type': 'line', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#24529A', 'line-width': 2 } },
  { 'id': 'gl-draw-line-active', 'type': 'line', 'filter': ['all', ['==', 'active', 'true'], ['==', '$type', 'LineString']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#D87822', 'line-dasharray': [0.2, 2], 'line-width': 2 } },
  { 'id': 'gl-draw-polygon-and-line-vertex-stroke-inactive', 'type': 'circle', 'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']], 'paint': { 'circle-radius': 8, 'circle-color': '#fff' } },
  { 'id': 'gl-draw-polygon-and-line-vertex-inactive', 'type': 'circle', 'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['!=', 'mode', 'static']], 'paint': { 'circle-radius': 6, 'circle-color': '#D87822' } },
  { 'id': 'gl-draw-polygon-and-line-vertex-stroke-active', 'type': 'circle', 'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['==', 'active', 'true']], 'paint': { 'circle-radius': 10, 'circle-color': '#fff' } },
  { 'id': 'gl-draw-polygon-and-line-vertex-active', 'type': 'circle', 'filter': ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['==', 'active', 'true']], 'paint': { 'circle-radius': 8, 'circle-color': '#D87822' } },
  { 'id': 'gl-draw-point-point-stroke-inactive', 'type': 'circle', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']], 'paint': { 'circle-radius': 6, 'circle-color': '#fff' } },
  { 'id': 'gl-draw-point-inactive', 'type': 'circle', 'filter': ['all', ['==', 'active', 'false'], ['==', '$type', 'Point'], ['==', 'meta', 'feature'], ['!=', 'mode', 'static']], 'paint': { 'circle-radius': 4, 'circle-color': '#24529A' } },
  { 'id': 'gl-draw-point-stroke-active', 'type': 'circle', 'filter': ['all', ['==', '$type', 'Point'], ['==', 'active', 'true'], ['==', 'meta', 'feature']], 'paint': { 'circle-radius': 8, 'circle-color': '#fff' } },
  { 'id': 'gl-draw-point-active', 'type': 'circle', 'filter': ['all', ['==', '$type', 'Point'], ['==', 'active', 'true'], ['==', 'meta', 'feature']], 'paint': { 'circle-radius': 6, 'circle-color': '#D87822' } },
  { 'id': 'gl-draw-polygon-fill-static', 'type': 'fill', 'filter': ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']], 'paint': { 'fill-color': '#7B8896', 'fill-outline-color': '#7B8896', 'fill-opacity': 0.1 } },
  { 'id': 'gl-draw-polygon-stroke-static', 'type': 'line', 'filter': ['all', ['==', 'mode', 'static'], ['==', '$type', 'Polygon']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#7B8896', 'line-width': 2 } },
  { 'id': 'gl-draw-line-static', 'type': 'line', 'filter': ['all', ['==', 'mode', 'static'], ['==', '$type', 'LineString']], 'layout': { 'line-cap': 'round', 'line-join': 'round' }, 'paint': { 'line-color': '#7B8896', 'line-width': 2 } },
  { 'id': 'gl-draw-point-static', 'type': 'circle', 'filter': ['all', ['==', 'mode', 'static'], ['==', '$type', 'Point']], 'paint': { 'circle-radius': 4, 'circle-color': '#7B8896' } }
];

const draw = new MapboxDraw({ displayControlsDefault: false, controls: {}, styles: customDrawStyles });
map.addControl(draw);

const activePopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true });

// Larger hit-test tolerance on touch devices — a 5px box around a fingertip
// tap is usually a miss, which is why popups felt broken on mobile while
// working fine with a mouse. A plain click event carries no pointer-type
// info, so we track it from the most recent pointerdown instead.
let lastPointerWasTouch = false;
map.getCanvasContainer().addEventListener('pointerdown', (e) => { lastPointerWasTouch = e.pointerType === 'touch'; }, { passive: true });

map.on('click', (e) => {
  const drawMode = draw.getMode();
  if (drawMode && drawMode.startsWith('draw_')) return; // let the active digitizing tool handle this click

  const visibleLayerIds = state.layers.filter(l => l.visible).flatMap(l => [`${l.id}-fill`, `${l.id}-outline`, `${l.id}-point`, `${l.id}-point-photo`]);
  if (!visibleLayerIds.length) return;

  const tolerance = lastPointerWasTouch ? 14 : 5;
  const bbox = [[e.point.x - tolerance, e.point.y - tolerance], [e.point.x + tolerance, e.point.y + tolerance]];
  const features = map.queryRenderedFeatures(bbox, { layers: visibleLayerIds });
  if (!features.length) return;

  const feat = features[0];
  const parentLayer = state.layers.find(l => l.id === feat.layer.source);

  let html = `<div class="popup-feature-title">${parentLayer ? parentLayer.name : 'Feature'}</div><table class="popup-table">`;
  const props = feat.properties || {};
  let photoUrl = null;

  Object.keys(props).forEach(k => {
    if (k === '_gis_id') return;
    if (k === 'photo' && props[k]) { photoUrl = props[k]; return; }
    html += `<tr><td class="k">${k}:</td><td>${props[k]}</td></tr>`;
  });
  html += '</table>';
  if (photoUrl) {
    // No inline onclick / data URL embedded twice — the click is wired up
    // below via addEventListener once the popup element actually exists.
    html += `<div class="popup-photo-container"><img alt="Attached photo" title="Tap to view full size" /></div>`;
  }

  activePopup.setLngLat(e.lngLat).setHTML(html).addTo(map);

  if (photoUrl) {
    const imgEl = activePopup.getElement().querySelector('.popup-photo-container img');
    if (imgEl) { imgEl.src = photoUrl; imgEl.addEventListener('click', () => openImageLightbox(photoUrl)); }
  }
});

map.on('draw.modechange', (e) => {
  document.querySelectorAll('.map-tool-btn').forEach(b => b.classList.remove('is-active'));
  const modeToBtn = { draw_point: els.drawPointBtn, draw_line_string: els.drawLineBtn, draw_polygon: els.drawPolyBtn };
  modeToBtn[e.mode]?.classList.add('is-active');

  // Crosshair while actively placing vertices; plain arrow the rest of the time
  // (overrides MapLibre's own grab/grabbing pan cursor — see style.css).
  map.getCanvasContainer().classList.toggle('mode-drawing', e.mode.startsWith('draw_'));
});

function syncDrawToActiveLayer() {
  const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
  if (!activeLayer) return;

  activeLayer.data.features = draw.getAll().features.map(df => {
    if (!df.properties._gis_id) df.properties._gis_id = `feat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    return df;
  });

  renderLayerOnMap(activeLayer);
  if (state.isTableVisible) renderAttributeTable(activeLayer);
}

map.on('draw.create', () => {
  syncDrawToActiveLayer();
  if (state.currentDrawMode && state.isEditModeActive) {
    setTimeout(() => { try { draw.changeMode(state.currentDrawMode); } catch (err) {} }, 50);
  }
});
map.on('draw.update', syncDrawToActiveLayer);
map.on('draw.delete', syncDrawToActiveLayer);
map.on('draw.selectionchange', (e) => {
  if (e.features.length > 0) {
    state.selectedFeatureId = e.features[0].properties._gis_id;
    if (state.isTableVisible) highlightSelectedFeatureInTable(state.selectedFeatureId);
  }
});

async function guardEditAction() {
  if (!state.activeLayerId) {
    await modalAlert('No active layer', 'Select or create a layer in the Layers tab first.');
    return false;
  }
  const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
  if (activeLayer && !activeLayer.visible) {
    await modalAlert('Layer hidden', 'This layer is hidden. Show it (the eye button) before editing it.');
    return false;
  }
  if (!state.isEditModeActive) {
    await modalAlert('Layer locked', 'This layer is locked for editing. Use the unlock (pencil) button next to the layer name to enable editing.');
    draw.changeMode('simple_select');
    return false;
  }
  return true;
}

els.drawPointBtn.addEventListener('click', async () => { if (!await guardEditAction()) return; state.currentDrawMode = 'draw_point'; draw.changeMode('draw_point'); });
els.drawLineBtn.addEventListener('click', async () => { if (!await guardEditAction()) return; state.currentDrawMode = 'draw_line_string'; draw.changeMode('draw_line_string'); });
els.drawPolyBtn.addEventListener('click', async () => { if (!await guardEditAction()) return; state.currentDrawMode = 'draw_polygon'; draw.changeMode('draw_polygon'); });
els.trashBtn.addEventListener('click', async () => { if (!await guardEditAction()) return; draw.trash(); });

els.newLayerBtn.addEventListener('click', async () => {
  const suggested = `layer_${state.layers.length + 1}`;
  const name = await modalPrompt('New scratch layer', 'Name the new layer.', suggested);
  if (name === null) return;
  addLayer(name || suggested, { type: 'FeatureCollection', features: [] });
  state.isEditModeActive = true; // a freshly created scratch layer is meant to be drawn into immediately
  renderLayerList();
  switchToTab('style');
});

const geolocateControl = new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true });
map.addControl(geolocateControl, 'top-right');
els.gpsLocateBtn.addEventListener('click', () => geolocateControl.trigger());

els.recordGpsBtn.addEventListener('click', async () => {
  let activeLayer = state.layers.find(l => l.id === state.activeLayerId);

  if (!activeLayer || !state.isEditModeActive) {
    const visibleLayers = state.layers.filter(l => l.visible);
    if (visibleLayers.length === 1) {
      setActiveLayer(visibleLayers[0].id);
      state.isEditModeActive = true;
      activeLayer = visibleLayers[0];
    } else {
      const layerName = await modalPrompt('New GPS point layer', 'Name the scratch layer that will hold recorded points.', 'gps_points');
      if (!layerName) return;
      activeLayer = addLayer(layerName, { type: 'FeatureCollection', features: [] });
      state.isEditModeActive = true;
    }
    renderLayerList();
  }

  if (!navigator.geolocation) { await modalAlert('Geolocation unavailable', 'This browser does not support geolocation.'); return; }

  setStatus('Fetching GPS position (trying high accuracy)…');

  // Three-stage fallback: fresh high-accuracy GPS fix -> fresh standard-accuracy
  // fix (usually Wi-Fi/cell positioning) -> a cached "approximate" position up
  // to 5 minutes old, which succeeds even when a fresh fix keeps timing out.
  const STAGES = [
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0, label: 'high-accuracy GPS' },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 0, label: 'standard-accuracy' },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000, label: 'approximate (cached)' },
  ];

  const fetchPosition = (stageIndex) => {
    const stage = STAGES[stageIndex];
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('');
        const { longitude: lng, latitude: lat, accuracy } = position.coords;
        const approxNote = stage.maximumAge > 0 ? ' (approximate — using a recent cached fix)' : '';
        const takePhoto = await modalConfirm('Attach a photo?', `Accuracy: ~${Math.round(accuracy)}m${approxNote}. Attach or capture a photo for this point?`, { confirmLabel: 'Add photo', cancelLabel: 'Skip' });
        if (takePhoto) {
          triggerPhotoCapture((photoDataUrl) => completeRecordPoint(activeLayer, lng, lat, accuracy, photoDataUrl));
        } else {
          completeRecordPoint(activeLayer, lng, lat, accuracy, '');
        }
      },
      async (err) => {
        if (stageIndex < STAGES.length - 1) {
          setStatus(`${stage.label} location timed out. Trying ${STAGES[stageIndex + 1].label} location…`);
          fetchPosition(stageIndex + 1);
        } else {
          setStatus('GPS unavailable.', 'error');
          await modalAlert(
            'Could not determine location',
            'Every location attempt failed or timed out. This is usually one of: Location Services turned off at the OS level, this site denied location permission in the browser, or (on a laptop/desktop without GPS hardware) a slow Wi-Fi-based position lookup. Check your device and browser location settings and try again.'
          );
        }
      },
      stage
    );
  };
  fetchPosition(0);
});

function triggerPhotoCapture(callback) {
  els.cameraInput.value = '';
  els.cameraInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) { callback(''); return; }
    const reader = new FileReader();
    reader.onload = (ev) => callback(ev.target.result);
    reader.readAsDataURL(file);
  };
  els.cameraInput.click();
}

async function completeRecordPoint(activeLayer, lng, lat, accuracy, photoDataUrl) {
  const label = await modalPrompt('Label this point', `Accuracy: ~${Math.round(accuracy)}m`, `Waypoint_${Date.now().toString().slice(-4)}`);
  if (label === null) return;

  const newPointFeature = {
    type: 'Feature',
    properties: {
      _gis_id: `feat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: label, latitude: lat, longitude: lng,
      accuracy_m: Math.round(accuracy * 10) / 10, photo: photoDataUrl, timestamp: new Date().toISOString()
    },
    geometry: { type: 'Point', coordinates: [lng, lat] }
  };

  activeLayer.data.features.push(newPointFeature);
  draw.set(activeLayer.data);
  renderLayerOnMap(activeLayer);
  if (state.isTableVisible) renderAttributeTable(activeLayer);

  map.flyTo({ center: [lng, lat], zoom: 16 });
  setStatus(`Recorded GPS point into "${activeLayer.name}" (~${Math.round(accuracy)}m${photoDataUrl ? ', with photo' : ''})`, 'ok');
}

/* -----------------------------------------------------------
   Geoprocessing
----------------------------------------------------------- */
async function runBuffer() {
  const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
  if (!activeLayer || !activeLayer.data.features.length) {
    await modalAlert('No features', 'Select an active layer that contains features.');
    return;
  }

  const distanceInput = await modalPrompt('Buffer distance', 'Enter the buffer distance in kilometres.', '1', { placeholder: 'e.g. 0.5' });
  if (distanceInput === null) return;
  const distance = parseFloat(distanceInput);
  if (isNaN(distance) || distance <= 0) { await modalAlert('Invalid distance', 'Enter a positive number of kilometres.'); return; }

  try {
    const bufferedFeatures = activeLayer.data.features
      .map(f => { const b = turf.buffer(f, distance, { units: 'kilometers' }); if (b) b.properties = { ...f.properties, buffer_dist_km: distance }; return b; })
      .filter(Boolean);

    if (!bufferedFeatures.length) { setStatus('Buffer operation produced no geometry.', 'error'); return; }

    const newLayerName = `${activeLayer.name}_buffer_${distance}km`;
    addLayer(newLayerName, { type: 'FeatureCollection', features: bufferedFeatures });
    setStatus(`Created buffer layer: ${newLayerName}`, 'ok');
    switchToTab('layers');
  } catch (err) {
    console.error(err);
    setStatus(`Buffer failed: ${err.message}`, 'error');
  }
}

function updateClipMaskDropdown() {
  if (!els.clipMaskSelect) return;
  const activeLayerId = state.activeLayerId;
  const validMasks = state.layers.filter(l => l.id !== activeLayerId && l.data.features.some(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')));
  els.clipMaskSelect.innerHTML = '<option value="">(Select mask layer)</option>' + validMasks.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

async function runClip() {
  const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
  if (!activeLayer) { await modalAlert('No active layer', 'Select an active input layer first.'); return; }

  const maskLayerId = els.clipMaskSelect.value;
  if (!maskLayerId) { await modalAlert('No mask selected', 'Choose a polygon clip layer from the dropdown.'); return; }

  const maskLayer = state.layers.find(l => l.id === maskLayerId);
  if (!maskLayer) return;

  try {
    const maskPolygons = maskLayer.data.features.filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
    if (!maskPolygons.length) { await modalAlert('Invalid mask layer', `"${maskLayer.name}" must contain Polygon or MultiPolygon features.`); return; }

    let maskUnion = maskPolygons[0];
    for (let i = 1; i < maskPolygons.length; i++) {
      const unionResult = turf.union(maskUnion, maskPolygons[i]);
      if (unionResult) maskUnion = unionResult;
    }

    const clippedFeatures = [];
    activeLayer.data.features.forEach(feature => {
      if (!feature.geometry) return;
      try {
        const clipped = turf.intersect(feature, maskUnion);
        if (clipped) { clipped.properties = { ...feature.properties }; clippedFeatures.push(clipped); }
      } catch (clipErr) { console.warn('Individual feature clip skipped:', clipErr); }
    });

    if (!clippedFeatures.length) { setStatus('Clip result is empty. No features intersected the mask.', 'error'); return; }

    const newLayerName = `${activeLayer.name}_clipped_by_${maskLayer.name}`;
    addLayer(newLayerName, { type: 'FeatureCollection', features: clippedFeatures });
    setStatus(`Created clipped layer: ${newLayerName}`, 'ok');
    switchToTab('layers');
  } catch (err) {
    console.error(err);
    setStatus(`Clip failed: ${err.message}`, 'error');
  }
}

els.bufferBtn?.addEventListener('click', runBuffer);
els.clipBtn?.addEventListener('click', runClip);

/* -----------------------------------------------------------
   PDF print
----------------------------------------------------------- */
function printMapToPdf() {
  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { toast('jsPDF library failed to load.', 'error'); return; }

    setStatus('Rendering map canvas for PDF export…');
    map.triggerRepaint();

    setTimeout(() => {
      const mapDataUrl = map.getCanvas().toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      const pageWidth = 297, pageHeight = 210, margin = 12, bottomFooterHeight = 22;
      pdf.setLineWidth(0.5); pdf.setDrawColor(36, 82, 154);
      pdf.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

      const frameX = margin + 4, frameY = margin + 4;
      const frameWidth = pageWidth - margin * 2 - 8;
      const frameHeight = pageHeight - margin * 2 - bottomFooterHeight - 4;

      pdf.setLineWidth(0.2);
      pdf.rect(frameX, frameY, frameWidth, frameHeight);
      pdf.addImage(mapDataUrl, 'PNG', frameX, frameY, frameWidth, frameHeight);

      const footerY = frameY + frameHeight + 2, footerHeight = bottomFooterHeight - 2;
      pdf.setFillColor(233, 237, 243);
      pdf.rect(frameX, footerY, frameWidth, footerHeight, 'F');

      const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
      const titleFieldValue = document.getElementById('mapTitleInput').value.trim();
      const mapTitle = titleFieldValue || (activeLayer ? `MAP SHEET: ${activeLayer.name.toUpperCase()}` : 'WEBGIS SPATIAL REPORT');
      const centerCoord = map.getCenter();
      const zoomLevel = map.getZoom().toFixed(1);
      const dateStr = new Date().toISOString().split('T')[0];

      pdf.setTextColor(25, 29, 35);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
      pdf.text(mapTitle, frameX + 6, footerY + 7);

      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
      pdf.setTextColor(80, 90, 104);
      pdf.text(`Center Lat/Lng: ${centerCoord.lat.toFixed(4)}°, ${centerCoord.lng.toFixed(4)}°   |   Zoom: ${zoomLevel}`, frameX + 6, footerY + 13);
      pdf.text(`Date: ${dateStr}`, frameX + 6, footerY + 18);

      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
      pdf.setTextColor(216, 120, 34);
      pdf.text('N ▲', frameX + frameWidth - 20, footerY + 10);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
      pdf.text('SCALE VARIES', frameX + frameWidth - 28, footerY + 16);

      const filename = activeLayer ? `${activeLayer.name.replace(/[^a-zA-Z0-9_]/g, '_')}_map.pdf` : 'webgis_map.pdf';
      pdf.save(filename);
      setStatus('Map printed and exported to PDF successfully!', 'ok');
    }, 250);
  } catch (err) {
    console.error(err);
    setStatus(`PDF export failed: ${err.message}`, 'error');
  }
}
els.printPdfBtn?.addEventListener('click', printMapToPdf);

/* -----------------------------------------------------------
   JPG export — plain raster snapshot of the current view.
----------------------------------------------------------- */
function safeExportName() {
  const title = document.getElementById('mapTitleInput').value.trim();
  return (title || 'webgis_map').replace(/[^a-zA-Z0-9_-]/g, '_');
}

document.getElementById('expJpg').addEventListener('click', () => {
  try {
    map.triggerRepaint();
    setTimeout(() => {
      const dataUrl = map.getCanvas().toDataURL('image/jpeg', 0.92);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${safeExportName()}.jpg`;
      a.click();
      setStatus('Exported JPG image.', 'ok');
    }, 200);
  } catch (err) {
    console.error(err);
    setStatus(`JPG export failed: ${err.message}`, 'error');
  }
});

/* -----------------------------------------------------------
   GeoTIFF export — minimal, hand-written baseline TIFF + GeoTIFF
   tags (uncompressed RGB, single strip, WGS84 geographic tiepoint).
   This assigns a LINEAR degrees-per-pixel scale across the current
   viewport's N/S/E/W bounds. That is a simplification, not a true
   reprojection from the map's Web Mercator projection — accurate
   enough for small/moderate extents, but it will skew at high
   latitudes or wide zoomed-out views. It is a standard lightweight
   technique (equivalent to a PNG + world file) and opens correctly
   as a georeferenced raster in QGIS and GDAL-based tools.
----------------------------------------------------------- */
function buildGeoTiff(imageData, width, height, bounds) {
  const { west, south, east, north } = bounds;
  const scaleX = (east - west) / width;
  const scaleY = (north - south) / height;

  const pixelDataOffset = 332;
  const pixelByteCount = width * height * 3;
  const buffer = new ArrayBuffer(pixelDataOffset + pixelByteCount);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Header
  bytes[0] = 0x49; bytes[1] = 0x49; // 'II' little-endian
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true); // offset to IFD

  // IFD (16 entries)
  const TAGS = [
    [256, 4, 1, width],                 // ImageWidth
    [257, 4, 1, height],                // ImageLength
    [258, 3, 3, 206],                   // BitsPerSample -> external
    [259, 3, 1, 1],                     // Compression: none
    [262, 3, 1, 2],                     // PhotometricInterpretation: RGB
    [273, 4, 1, pixelDataOffset],       // StripOffsets
    [277, 3, 1, 3],                     // SamplesPerPixel
    [278, 4, 1, height],                // RowsPerStrip
    [279, 4, 1, pixelByteCount],        // StripByteCounts
    [282, 5, 1, 212],                   // XResolution -> external
    [283, 5, 1, 220],                   // YResolution -> external
    [284, 3, 1, 1],                     // PlanarConfiguration: chunky
    [296, 3, 1, 2],                     // ResolutionUnit: inch
    [33550, 12, 3, 228],                // ModelPixelScaleTag -> external
    [33922, 12, 6, 252],                // ModelTiepointTag -> external
    [34735, 3, 16, 300],                // GeoKeyDirectoryTag -> external
  ];

  let pos = 8;
  view.setUint16(pos, TAGS.length, true); pos += 2;
  for (const [tag, type, count, value] of TAGS) {
    view.setUint16(pos, tag, true); pos += 2;
    view.setUint16(pos, type, true); pos += 2;
    view.setUint32(pos, count, true); pos += 4;
    if (type === 3 && count === 1) { view.setUint16(pos, value, true); view.setUint16(pos + 2, 0, true); }
    else view.setUint32(pos, value, true);
    pos += 4;
  }
  view.setUint32(pos, 0, true); pos += 4; // no next IFD

  // External value blocks (offsets must match the TAGS table above)
  view.setUint16(206, 8, true); view.setUint16(208, 8, true); view.setUint16(210, 8, true); // BitsPerSample
  view.setUint32(212, 72, true); view.setUint32(216, 1, true); // XResolution 72/1
  view.setUint32(220, 72, true); view.setUint32(224, 1, true); // YResolution 72/1
  view.setFloat64(228, scaleX, true); view.setFloat64(236, scaleY, true); view.setFloat64(244, 0, true); // ModelPixelScale
  view.setFloat64(252, 0, true); view.setFloat64(260, 0, true); view.setFloat64(268, 0, true);
  view.setFloat64(276, west, true); view.setFloat64(284, north, true); view.setFloat64(292, 0, true); // ModelTiepoint (raster 0,0 -> west,north)
  // GeoKeyDirectory: header + GTModelTypeGeoKey(Geographic) + GTRasterTypeGeoKey(Area) + GeographicTypeGeoKey(WGS84)
  const geoKeys = [1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, 1, 2048, 0, 1, 4326];
  geoKeys.forEach((v, i) => view.setUint16(300 + i * 2, v, true));

  // Pixel data: RGBA canvas -> RGB, row order preserved (row 0 = north edge, matching the tiepoint)
  for (let i = 0, p = pixelDataOffset; i < imageData.length; i += 4, p += 3) {
    bytes[p] = imageData[i]; bytes[p + 1] = imageData[i + 1]; bytes[p + 2] = imageData[i + 2];
  }

  return new Blob([buffer], { type: 'image/tiff' });
}

document.getElementById('expGeoTiff').addEventListener('click', async () => {
  try {
    map.triggerRepaint();
    await new Promise(r => setTimeout(r, 200));

    const canvas = map.getCanvas();
    const width = canvas.width, height = canvas.height;
    const ctx = canvas.getContext('webgl') ? null : canvas.getContext('2d');
    // MapLibre's canvas is WebGL-backed; read pixels via a 2D copy canvas.
    const copy = document.createElement('canvas');
    copy.width = width; copy.height = height;
    copy.getContext('2d').drawImage(canvas, 0, 0);
    const imageData = copy.getContext('2d').getImageData(0, 0, width, height).data;

    const b = map.getBounds();
    const bounds = { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };

    const blob = buildGeoTiff(imageData, width, height, bounds);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeExportName()}.tif`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Exported GeoTIFF (WGS84 linear tiepoint).', 'ok');
  } catch (err) {
    console.error(err);
    setStatus(`GeoTIFF export failed: ${err.message}`, 'error');
  }
});

/* -----------------------------------------------------------
   File loading
----------------------------------------------------------- */
els.openFileBtn.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', e => { if (e.target.files.length) handleFile(e.target.files[0]); });

['dragover', 'dragenter'].forEach(evt => els.mapWrap.addEventListener(evt, e => { e.preventDefault(); els.mapWrap.classList.add('dragover'); }));
['dragleave', 'drop'].forEach(evt => els.mapWrap.addEventListener(evt, e => { e.preventDefault(); els.mapWrap.classList.remove('dragover'); }));
els.mapWrap.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });

async function handleFile(file) {
  const name = file.name;
  const ext = name.split('.').pop().toLowerCase();
  setStatus(`Loading ${name}…`);
  try {
    if (ext === 'gpkg') {
      await loadGeoPackage(file);
      setStatus(`Loaded ${name}`, 'ok');
    } else if (ext === 'zip') {
      const buf = await file.arrayBuffer();
      const result = await shp(buf);
      const collections = Array.isArray(result) ? result : [result];
      collections.forEach((fc, i) => addLayer(collections.length > 1 ? `${baseName(name)}_${i + 1}` : baseName(name), fc));
      setStatus(`Loaded ${name}`, 'ok');
    } else if (ext === 'geojson' || ext === 'json') {
      const text = await file.text();
      addLayer(baseName(name), JSON.parse(text));
      setStatus(`Loaded ${name}`, 'ok');
    } else if (ext === 'tif' || ext === 'tiff') {
      await loadGeoTiffRaster(file);
      setStatus(`Loaded ${name}`, 'ok');
    } else {
      setStatus(`Unsupported file type: .${ext}`, 'error');
    }
    switchToTab('layers');
  } catch (err) {
    console.error(err);
    setStatus(`Error loading ${name}: ${err.message}`, 'error');
  }
}
function baseName(filename) { return filename.replace(/\.[^/.]+$/, ''); }

/* -----------------------------------------------------------
   GeoTIFF import — parsed with geotiff.js, drawn to a canvas, and
   placed as a MapLibre image source. Only correctly placed when the
   file's embedded CRS is geographic WGS84 (EPSG:4326); this app does
   not reproject rasters, matching the same honesty-over-false-
   precision approach as the GeoTIFF export above.
----------------------------------------------------------- */
async function loadGeoTiffRaster(file) {
  const tiff = await GeoTIFF.fromBlob(file);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY]

  const geoKeys = image.getGeoKeys ? image.getGeoKeys() : {};
  const epsg = geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey;
  if (epsg && epsg !== 4326) {
    const proceed = await modalConfirm(
      'Raster is not WGS84',
      `This GeoTIFF's embedded CRS is EPSG:${epsg}, not WGS84 (EPSG:4326). This app does not reproject rasters, so the image will most likely be placed in the wrong location. Reproject it to EPSG:4326 in QGIS first for accurate placement.`,
      { confirmLabel: 'Load anyway', danger: true }
    );
    if (!proceed) return;
  }

  const samplesPerPixel = image.getSamplesPerPixel();
  const rasters = await image.readRasters({ interleave: true });

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  for (let i = 0, p = 0; i < width * height; i++, p += samplesPerPixel) {
    const o = i * 4;
    imgData.data[o] = rasters[p];
    imgData.data[o + 1] = samplesPerPixel > 1 ? rasters[p + 1] : rasters[p];
    imgData.data[o + 2] = samplesPerPixel > 2 ? rasters[p + 2] : rasters[p];
    imgData.data[o + 3] = samplesPerPixel > 3 ? rasters[p + 3] : 255;
  }
  ctx.putImageData(imgData, 0, 0);

  const [minX, minY, maxX, maxY] = bbox;
  const sourceId = 'raster_' + Math.random().toString(36).substr(2, 8);
  map.addSource(sourceId, {
    type: 'image', url: canvas.toDataURL('image/png'),
    coordinates: [[minX, maxY], [maxX, maxY], [maxX, minY], [minX, minY]],
  });
  map.addLayer({ id: `${sourceId}-layer`, type: 'raster', source: sourceId, paint: { 'raster-opacity': 1 } });

  state.rasterLayers.push({ id: sourceId, name: baseName(file.name), visible: true, bounds: [minX, minY, maxX, maxY] });
  renderRasterLayerList();
  map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 40, duration: 400 });
}

function renderRasterLayerList() {
  if (!state.rasterLayers.length) {
    els.rasterLayerList.innerHTML = '<p class="empty">No raster layers loaded.</p>';
    return;
  }
  els.rasterLayerList.innerHTML = state.rasterLayers.map(r => `
    <div class="layer-row${!r.visible ? ' hidden-layer' : ''}" data-raster-id="${r.id}" role="listitem">
      <span class="swatch" style="background:var(--ih-text-muted)"></span>
      <span class="name" title="${r.name}">${r.name}</span>
      <span class="actions">
        <button data-action="vis" title="Toggle visibility">${r.visible ? ICON_EYE_OPEN : ICON_EYE_CLOSED}</button>
        <button data-action="zoom" title="Zoom to raster">${ICON_ZOOM}</button>
        <button data-action="del" class="del" title="Remove raster">${ICON_DELETE}</button>
      </span>
    </div>`).join('');
}

els.rasterLayerList.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  const row = e.target.closest('.layer-row');
  if (!actionEl || !row) return;
  const raster = state.rasterLayers.find(r => r.id === row.dataset.rasterId);
  if (!raster) return;

  switch (actionEl.dataset.action) {
    case 'vis':
      raster.visible = !raster.visible;
      if (map.getLayer(`${raster.id}-layer`)) map.setLayoutProperty(`${raster.id}-layer`, 'visibility', raster.visible ? 'visible' : 'none');
      renderRasterLayerList();
      break;
    case 'zoom': {
      const [minX, minY, maxX, maxY] = raster.bounds;
      map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 40, duration: 400 });
      break;
    }
    case 'del':
      if (map.getLayer(`${raster.id}-layer`)) map.removeLayer(`${raster.id}-layer`);
      if (map.getSource(raster.id)) map.removeSource(raster.id);
      state.rasterLayers = state.rasterLayers.filter(r => r.id !== raster.id);
      renderRasterLayerList();
      break;
  }
});

let _sqlJsPromise = null;
function getSqlJs() {
  if (!_sqlJsPromise) _sqlJsPromise = initSqlJs({ locateFile: f => `https://unpkg.com/sql.js@1.10.3/dist/${f}` });
  return _sqlJsPromise;
}

function parseWKB(bytes, byteOffset = 0) {
  const view = new DataView(bytes.buffer, bytes.byteOffset + byteOffset, bytes.byteLength - byteOffset);
  let pos = 0;
  const u8 = () => view.getUint8(pos++);
  const u32 = (le) => { const v = view.getUint32(pos, le); pos += 4; return v; };
  const f64 = (le) => { const v = view.getFloat64(pos, le); pos += 8; return v; };

  const le = u8() === 1;
  let rawType = u32(le);
  const hasZ = (rawType >= 1000 && rawType < 2000) || (rawType >= 3000 && rawType < 4000) || ((rawType & 0x80000000) !== 0);
  const hasM = (rawType >= 2000 && rawType < 3000) || (rawType >= 3000 && rawType < 4000) || ((rawType & 0x40000000) !== 0);
  let baseType = rawType % 1000;
  if (baseType === 0) baseType = rawType & 0xFF;

  const readPoint = (le) => { const x = f64(le), y = f64(le); if (hasZ) f64(le); if (hasM) f64(le); return [x, y]; };
  const readLine = (le) => { const n = u32(le); const pts = []; for (let i = 0; i < n; i++) pts.push(readPoint(le)); return pts; };
  const readPolygon = (le) => { const n = u32(le); const rings = []; for (let i = 0; i < n; i++) rings.push(readLine(le)); return rings; };

  switch (baseType) {
    case 1: return { type: 'Point', coordinates: readPoint(le) };
    case 2: return { type: 'LineString', coordinates: readLine(le) };
    case 3: return { type: 'Polygon', coordinates: readPolygon(le) };
    case 4: return { type: 'MultiPoint', coordinates: Array.from({ length: u32(le) }, () => { u8(); u32(le); return readPoint(le); }) };
    case 5: return { type: 'MultiLineString', coordinates: Array.from({ length: u32(le) }, () => { u8(); u32(le); return readLine(le); }) };
    case 6: return { type: 'MultiPolygon', coordinates: Array.from({ length: u32(le) }, () => { u8(); u32(le); return readPolygon(le); }) };
    default: throw new Error('Unsupported WKB type: ' + rawType);
  }
}

function transformCoords(coords, transformFn) {
  if (typeof coords[0] === 'number') return transformFn(coords);
  return coords.map(c => transformCoords(c, transformFn));
}

async function loadGeoPackage(file) {
  const SQL = await getSqlJs();
  const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
  try {
    const contentsRes = db.exec("SELECT table_name FROM gpkg_contents WHERE data_type='features'");
    if (!contentsRes.length) throw new Error('No feature tables in GeoPackage.');

    const geomColRes = db.exec('SELECT table_name, column_name, srs_id FROM gpkg_geometry_columns');
    const geomMeta = {};
    if (geomColRes.length) geomColRes[0].values.forEach(([t, c, srs]) => geomMeta[t] = { col: c, srsId: srs });

    const srsRes = db.exec('SELECT srs_id, definition FROM gpkg_spatial_ref_sys');
    const srsMap = {};
    if (srsRes.length) srsRes[0].values.forEach(([id, def]) => srsMap[id] = def);

    for (const table of contentsRes[0].values.map(r => r[0])) {
      const meta = geomMeta[table] || { col: 'geom', srsId: 4326 };
      const res = db.exec(`SELECT * FROM "${table}"`);
      if (!res.length) continue;
      const cols = res[0].columns;
      const geomIdx = cols.indexOf(meta.col);

      let transformFn = null;
      const srsId = meta.srsId;
      if (srsId && srsId !== 4326 && srsId > 0) {
        const wktOrProj = srsMap[srsId];
        if (wktOrProj) {
          try { proj4.defs(`EPSG:${srsId}`, wktOrProj); transformFn = (pt) => proj4(`EPSG:${srsId}`, 'EPSG:4326', pt); } catch (e) {}
        }
      }

      const features = res[0].values.map(row => {
        const properties = {};
        cols.forEach((c, i) => { if (i !== geomIdx) properties[c] = row[i]; });
        let geometry = null;
        if (geomIdx >= 0 && row[geomIdx]) {
          const blob = new Uint8Array(row[geomIdx]);
          const envLen = [0, 32, 48, 48, 64][(blob[3] >> 1) & 0x07] || 0;
          geometry = parseWKB(blob, 8 + envLen);
          if (geometry && transformFn) { try { geometry.coordinates = transformCoords(geometry.coordinates, transformFn); } catch (err) {} }
        }
        return { type: 'Feature', properties, geometry };
      }).filter(f => f.geometry);

      addLayer(table, { type: 'FeatureCollection', features });
    }
  } finally { db.close(); }
}

/* -----------------------------------------------------------
   Layer model + map rendering
----------------------------------------------------------- */
function addLayer(name, geojson) {
  if (!geojson || geojson.type !== 'FeatureCollection') {
    geojson = { type: 'FeatureCollection', features: geojson.features || [geojson] };
  }
  geojson.features.forEach((f, i) => {
    f.properties = f.properties || {};
    if (!f.properties._gis_id) f.properties._gis_id = `feat_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`;
  });

  const seedColor = nextColor();
  const layer = {
    id: 'layer_' + Math.random().toString(36).substr(2, 8),
    name, color: seedColor, pointColor: seedColor, lineColor: seedColor, fillColor: seedColor,
    width: 2, opacity: 0.3, labelField: '', visible: true, data: geojson,
  };

  state.layers.unshift(layer);
  renderLayerOnMap(layer);
  setActiveLayer(layer.id);
  if (layer.data.features.length) fitToLayer(layer);
  updateStatusLayerCount();
  return layer;
}

function updateMapLayerOrder() {
  [...state.layers].reverse().forEach(layer => {
    ['fill', 'outline', 'point', 'point-photo', 'label'].forEach(suffix => {
      const layerId = `${layer.id}-${suffix}`;
      if (map.getLayer(layerId)) map.moveLayer(layerId);
    });
  });
}

function renderLayerOnMap(layer) {
  if (map.getSource(layer.id)) {
    map.getSource(layer.id).setData(layer.data);
    updateLayerStyles(layer);
    updateMapLayerOrder();
    return;
  }

  map.addSource(layer.id, { type: 'geojson', data: layer.data });

  map.addLayer({ id: `${layer.id}-fill`, type: 'fill', source: layer.id, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': layer.fillColor, 'fill-opacity': layer.opacity } });
  map.addLayer({ id: `${layer.id}-outline`, type: 'line', source: layer.id, filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'LineString']]], paint: { 'line-color': layer.lineColor, 'line-width': layer.width } });
  map.addLayer({ id: `${layer.id}-point`, type: 'circle', source: layer.id, filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['coalesce', ['get', 'photo'], ''], '']], paint: { 'circle-color': layer.pointColor, 'circle-radius': parseFloat(layer.width) + 3, 'circle-stroke-width': 1, 'circle-stroke-color': '#0E1520' } });
  map.addLayer({ id: `${layer.id}-point-photo`, type: 'circle', source: layer.id, filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['coalesce', ['get', 'photo'], ''], '']], paint: { 'circle-color': '#D87822', 'circle-radius': parseFloat(layer.width) + 5, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
  map.addLayer({ id: `${layer.id}-label`, type: 'symbol', source: layer.id, layout: {
    'text-field': layer.labelField ? ['get', layer.labelField] : '',
    'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
    'text-size': 12,
    // Points: offset the label clear of the marker instead of centring text on
    // top of it. Lines/polygons: keep the label centred on the feature as before.
    'text-anchor': ['case', ['==', ['geometry-type'], 'Point'], 'top', 'center'],
    'text-offset': ['case', ['==', ['geometry-type'], 'Point'], ['literal', [0, 0.9]], ['literal', [0, 0]]],
  }, paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 } });

  setLayerMapVisibility(layer, layer.visible);
  updateMapLayerOrder();
}

function setLayerMapVisibility(layer, visible) {
  const v = visible ? 'visible' : 'none';
  ['fill', 'outline', 'point', 'point-photo', 'label'].forEach(suffix => {
    if (map.getLayer(`${layer.id}-${suffix}`)) map.setLayoutProperty(`${layer.id}-${suffix}`, 'visibility', v);
  });
}

function updateLayerStyles(layer) {
  if (map.getLayer(`${layer.id}-fill`)) {
    map.setPaintProperty(`${layer.id}-fill`, 'fill-color', layer.fillColor);
    map.setPaintProperty(`${layer.id}-fill`, 'fill-opacity', parseFloat(layer.opacity));
  }
  if (map.getLayer(`${layer.id}-outline`)) {
    map.setPaintProperty(`${layer.id}-outline`, 'line-color', layer.lineColor);
    map.setPaintProperty(`${layer.id}-outline`, 'line-width', parseFloat(layer.width));
  }
  if (map.getLayer(`${layer.id}-point`)) {
    map.setPaintProperty(`${layer.id}-point`, 'circle-color', layer.pointColor);
    map.setPaintProperty(`${layer.id}-point`, 'circle-radius', parseFloat(layer.width) + 3);
  }
  if (map.getLayer(`${layer.id}-point-photo`)) map.setPaintProperty(`${layer.id}-point-photo`, 'circle-radius', parseFloat(layer.width) + 5);
  if (map.getLayer(`${layer.id}-label`)) map.setLayoutProperty(`${layer.id}-label`, 'text-field', layer.labelField ? ['get', layer.labelField] : '');
}

function setActiveLayer(id) {
  state.activeLayerId = id;
  const layer = state.layers.find(l => l.id === id);

  renderLayerList();
  updateClipMaskDropdown();

  if (!layer) {
    draw.deleteAll();
    els.drawToolbar.hidden = true;
    els.stylePanel.hidden = true;
    els.styleEmptyState.hidden = false;
    updateTableVisibility(false);
    state.currentDrawMode = null;
    state.isEditModeActive = false;
    return;
  }

  els.drawToolbar.hidden = false;
  els.stylePanel.hidden = false;
  els.styleEmptyState.hidden = true;

  els.stylePointColor.value = layer.pointColor;
  els.styleLineColor.value = layer.lineColor;
  els.styleFillColor.value = layer.fillColor;
  els.styleWidth.value = layer.width;
  els.styleOpacity.value = layer.opacity;

  // A hidden layer should not appear in the Draw overlay (which renders
  // independently of our own visibility toggle) or be editable until shown.
  draw.set(layer.visible ? layer.data : { type: 'FeatureCollection', features: [] });
  if (!state.isEditModeActive) draw.changeMode('simple_select');

  const fields = getLayerFields(layer);
  els.labelField.innerHTML = '<option value="">(None)</option>' + fields.map(f => `<option value="${f}">${f}</option>`).join('');
  els.labelField.value = layer.labelField || '';

  if (state.isTableVisible) renderAttributeTable(layer);
}

function getLayerFields(layer) {
  const fields = new Set();
  layer.data.features.forEach(f => Object.keys(f.properties || {}).forEach(k => { if (k !== '_gis_id') fields.add(k); }));
  return Array.from(fields);
}

function updateStatusLayerCount() {
  const n = state.layers.length;
  els.statusLayerCount.textContent = `${n} layer${n === 1 ? '' : 's'}`;
}

/* Layer list — rendered once per structural change, with a single
   delegated click handler instead of per-row listeners. */
function renderLayerList() {
  updateStatusLayerCount();
  if (!state.layers.length) {
    els.layerList.innerHTML = '<p class="empty">No layers loaded yet. Open a file or create a scratch layer.</p>';
    return;
  }
  els.layerList.innerHTML = state.layers.map((layer, idx) => {
    const isThisActive = layer.id === state.activeLayerId;
    const isEditing = isThisActive && state.isEditModeActive;
    return `
      <div class="layer-row${isThisActive ? ' active' : ''}${!layer.visible ? ' hidden-layer' : ''}" data-layer-id="${layer.id}" role="listitem">
        <span class="swatch-group" title="Point / line / fill colour">
          <span style="background:${layer.pointColor}"></span>
          <span style="background:${layer.lineColor}"></span>
          <span style="background:${layer.fillColor}"></span>
        </span>
        <span class="name" data-action="select" title="${layer.name}">${layer.name}</span>
        <span class="actions">
          <button data-action="up" title="Move up" ${idx === 0 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button>
          <button data-action="down" title="Move down" ${idx === state.layers.length - 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>
          <button data-action="edit" class="edit-btn${isEditing ? ' is-editing' : ''}" title="${isEditing ? 'Lock editing' : 'Unlock editing'}">
            ${isEditing ? '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'}
          </button>
          <button data-action="vis" title="Toggle visibility">${layer.visible ? ICON_EYE_OPEN : ICON_EYE_CLOSED}</button>
          <button data-action="zoom" title="Zoom to layer">${ICON_ZOOM}</button>
          <button data-action="export" title="Export this layer to GeoPackage">${ICON_DOWNLOAD}</button>
          <button data-action="del" class="del" title="Delete layer">${ICON_DELETE}</button>
        </span>
      </div>`;
  }).join('');
}

els.layerList.addEventListener('click', (e) => {
  const actionEl = e.target.closest('[data-action]');
  const row = e.target.closest('.layer-row');
  if (!actionEl || !row) return;
  const id = row.dataset.layerId;
  const layer = state.layers.find(l => l.id === id);
  if (!layer) return;
  const idx = state.layers.indexOf(layer);

  switch (actionEl.dataset.action) {
    case 'select': setActiveLayer(id); break;
    case 'up':
      if (idx > 0) { [state.layers[idx - 1], state.layers[idx]] = [state.layers[idx], state.layers[idx - 1]]; renderLayerList(); updateMapLayerOrder(); }
      break;
    case 'down':
      if (idx < state.layers.length - 1) { [state.layers[idx + 1], state.layers[idx]] = [state.layers[idx], state.layers[idx + 1]]; renderLayerList(); updateMapLayerOrder(); }
      break;
    case 'edit':
      if (id !== state.activeLayerId) { setActiveLayer(id); state.isEditModeActive = true; }
      else { state.isEditModeActive = !state.isEditModeActive; }
      if (!state.isEditModeActive) draw.changeMode('simple_select');
      renderLayerList();
      break;
    case 'vis':
      layer.visible = !layer.visible;
      setLayerMapVisibility(layer, layer.visible);
      // The Draw plugin renders the active layer's geometry through its own
      // layers, independent of our visibility toggle above — clear or
      // restore that overlay explicitly so a hidden layer actually disappears
      // (and stops being editable) instead of staying visible/editable.
      if (layer.id === state.activeLayerId) {
        if (layer.visible) { draw.set(layer.data); if (!state.isEditModeActive) draw.changeMode('simple_select'); }
        else { draw.deleteAll(); }
      }
      renderLayerList();
      break;
    case 'zoom': fitToLayer(layer); break;
    case 'export': exportGeoPackage(layer); break;
    case 'del': removeLayer(id); break;
  }
});

function removeLayer(id) {
  ['fill', 'outline', 'point', 'point-photo', 'label'].forEach(s => { if (map.getLayer(`${id}-${s}`)) map.removeLayer(`${id}-${s}`); });
  if (map.getSource(id)) map.removeSource(id);
  state.layers = state.layers.filter(l => l.id !== id);
  if (state.activeLayerId === id) setActiveLayer(state.layers[0]?.id || null);
  else { renderLayerList(); updateClipMaskDropdown(); }
}

/* Uses turf.bbox — correct for MultiPolygon/GeometryCollection and
   avoids a hand-rolled recursive coordinate flatten. */
function fitToLayer(layer) {
  if (!layer.data.features.length) return;
  try {
    const [minX, minY, maxX, maxY] = turf.bbox(layer.data);
    if (![minX, minY, maxX, maxY].every(Number.isFinite)) return;
    map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 48, duration: 400, maxZoom: 18 });
  } catch (err) { console.warn('fitToLayer failed:', err); }
}

els.stylePointColor.addEventListener('input', e => { const l = state.layers.find(x => x.id === state.activeLayerId); if (l) { l.pointColor = e.target.value; updateLayerStyles(l); renderLayerList(); } });
els.styleLineColor.addEventListener('input', e => { const l = state.layers.find(x => x.id === state.activeLayerId); if (l) { l.lineColor = e.target.value; updateLayerStyles(l); renderLayerList(); } });
els.styleFillColor.addEventListener('input', e => { const l = state.layers.find(x => x.id === state.activeLayerId); if (l) { l.fillColor = e.target.value; updateLayerStyles(l); renderLayerList(); } });
els.styleWidth.addEventListener('input', e => { const l = state.layers.find(x => x.id === state.activeLayerId); if (l) { l.width = e.target.value; updateLayerStyles(l); } });
els.styleOpacity.addEventListener('input', e => { const l = state.layers.find(x => x.id === state.activeLayerId); if (l) { l.opacity = e.target.value; updateLayerStyles(l); } });
els.labelField.addEventListener('change', e => { const l = state.layers.find(x => x.id === state.activeLayerId); if (l) { l.labelField = e.target.value; updateLayerStyles(l); } });

/* -----------------------------------------------------------
   Attribute table — delegated listeners, targeted DOM updates
----------------------------------------------------------- */
function updateTableVisibility(show) {
  state.isTableVisible = show;
  els.tablePanel.hidden = !show;
  els.toggleTableBtn.classList.toggle('is-active', show);
  if (show && state.activeLayerId) {
    const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
    if (activeLayer) renderAttributeTable(activeLayer);
  }
}

function renderAttributeTable(layer) {
  els.tableTitle.textContent = `Attributes — ${layer.name} (${layer.data.features.length} features)`;
  const fields = getLayerFields(layer);
  const thead = els.attrTable.querySelector('thead');
  const tbody = els.attrTable.querySelector('tbody');

  thead.innerHTML = `<tr><th>Actions</th>${fields.map(f => `<th>${f}</th>`).join('')}</tr>`;

  tbody.innerHTML = layer.data.features.map(f => {
    const isSelected = f.properties._gis_id === state.selectedFeatureId;
    let rowHtml = `<td><button class="cell-del-btn" data-action="del-feature" title="Delete feature">&times;</button></td>`;
    fields.forEach(field => {
      const val = f.properties[field] !== undefined ? f.properties[field] : '';
      if (field === 'photo' && val) {
        rowHtml += `<td><span style="color:var(--ih-primary);">Attached photo</span></td>`;
      } else {
        rowHtml += `<td><input data-field="${field}" value="${String(val).replace(/"/g, '&quot;')}" /></td>`;
      }
    });
    return `<tr data-gis-id="${f.properties._gis_id}" class="${isSelected ? 'selected' : ''}">${rowHtml}</tr>`;
  }).join('');
}

// Delegated: row selection, cell edits, and feature deletion all handled from one listener pair.
els.attrTable.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-gis-id]');
  if (!tr) return;
  const layer = state.layers.find(l => l.id === state.activeLayerId);
  if (!layer) return;

  if (e.target.closest('[data-action="del-feature"]')) {
    layer.data.features = layer.data.features.filter(f => f.properties._gis_id !== tr.dataset.gisId);
    draw.set(layer.data);
    renderLayerOnMap(layer);
    renderAttributeTable(layer);
    return;
  }

  state.selectedFeatureId = tr.dataset.gisId;
  highlightSelectedFeatureInTable(state.selectedFeatureId);
});

els.attrTable.addEventListener('change', (e) => {
  if (!e.target.matches('input[data-field]')) return;
  const tr = e.target.closest('tr[data-gis-id]');
  const layer = state.layers.find(l => l.id === state.activeLayerId);
  if (!layer || !tr) return;
  const feature = layer.data.features.find(f => f.properties._gis_id === tr.dataset.gisId);
  if (!feature) return;
  feature.properties[e.target.dataset.field] = e.target.value;
  draw.set(layer.data);
  renderLayerOnMap(layer);
});

function highlightSelectedFeatureInTable(gisId) {
  if (!state.isTableVisible) return;
  els.attrTable.querySelectorAll('tbody tr').forEach(tr => {
    const match = tr.dataset.gisId === gisId;
    tr.classList.toggle('selected', match);
    if (match) tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

els.addFieldBtn.addEventListener('click', async () => {
  const layer = state.layers.find(l => l.id === state.activeLayerId);
  if (!layer) return;
  const fieldName = await modalPrompt('New attribute field', 'Enter the column name to add to every feature.');
  if (!fieldName) return;
  layer.data.features.forEach(f => { f.properties[fieldName] = ''; });
  setActiveLayer(layer.id);
});

els.closeTableBtn.addEventListener('click', () => updateTableVisibility(false));
els.toggleTableBtn.addEventListener('click', () => updateTableVisibility(!state.isTableVisible));

/* -----------------------------------------------------------
   GeoPackage export — called per-row from the Layers tab, so which
   layer is being exported is always explicit rather than implied by
   whichever layer happens to be "active".
----------------------------------------------------------- */
function geoJsonToWKB(geometry) {
  const buffer = new ArrayBuffer(1024 * 64);
  const view = new DataView(buffer);
  let pos = 0;

  function writePoint(coords) { view.setFloat64(pos, coords[0], true); pos += 8; view.setFloat64(pos, coords[1], true); pos += 8; }
  function writeLine(coords) { view.setUint32(pos, coords.length, true); pos += 4; coords.forEach(writePoint); }
  function writePolygon(coords) { view.setUint32(pos, coords.length, true); pos += 4; coords.forEach(writeLine); }

  view.setUint8(pos++, 1);
  if (geometry.type === 'Point') { view.setUint32(pos, 1, true); pos += 4; writePoint(geometry.coordinates); }
  else if (geometry.type === 'LineString') { view.setUint32(pos, 2, true); pos += 4; writeLine(geometry.coordinates); }
  else if (geometry.type === 'Polygon') { view.setUint32(pos, 3, true); pos += 4; writePolygon(geometry.coordinates); }
  else throw new Error('Exporting ' + geometry.type + ' to WKB is not supported.');

  return new Uint8Array(buffer, 0, pos);
}

function buildGpkgHeaderBlob(wkbBytes) {
  const header = new Uint8Array(8 + wkbBytes.length);
  header[0] = 0x47; header[1] = 0x50; header[2] = 0; header[3] = 0;
  header.set(wkbBytes, 8);
  return header;
}

async function exportGeoPackage(layer) {
  if (!layer) return;

  try {
    const SQL = await getSqlJs();
    const db = new SQL.Database();

    db.exec(`
      CREATE TABLE gpkg_spatial_ref_sys (srs_name TEXT, srs_id INTEGER PRIMARY KEY, organization TEXT, organization_coordsys_id INTEGER, definition TEXT, description TEXT);
      CREATE TABLE gpkg_contents (table_name TEXT, data_type TEXT, identifier TEXT, description TEXT, last_change TEXT, min_x REAL, min_y REAL, max_x REAL, max_y REAL, srs_id INTEGER);
      CREATE TABLE gpkg_geometry_columns (table_name TEXT, column_name TEXT, geometry_type_name TEXT, srs_id INTEGER, z TINYINT, m TINYINT);

      INSERT INTO gpkg_spatial_ref_sys VALUES ('WGS 84', 4326, 'EPSG', 4326, 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]', 'longitude/latitude coordinate system in degrees');
      INSERT INTO gpkg_spatial_ref_sys VALUES ('Undefined cartesian SRS', -1, 'NONE', -1, 'undefined', 'undefined cartesian coordinate reference system');
      INSERT INTO gpkg_spatial_ref_sys VALUES ('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', 'undefined geographic coordinate reference system');
    `);

    const fields = getLayerFields(layer);
    const colDefs = fields.map(f => `"${f}" TEXT`).join(', ');
    const tableName = layer.name.replace(/[^a-zA-Z0-9_]/g, '_');

    db.exec(`CREATE TABLE "${tableName}" (id INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB${colDefs ? ', ' + colDefs : ''});`);
    db.exec(`INSERT INTO gpkg_contents VALUES ('${tableName}', 'features', '${tableName}', '', datetime('now'), -180, -90, 180, 90, 4326);`);
    db.exec(`INSERT INTO gpkg_geometry_columns VALUES ('${tableName}', 'geom', 'GEOMETRY', 4326, 0, 0);`);

    const placeholders = fields.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT INTO "${tableName}" (geom${fields.length ? ', ' + fields.map(f => `"${f}"`).join(', ') : ''}) VALUES (?${placeholders ? ', ' + placeholders : ''});`);

    layer.data.features.forEach(f => {
      if (!f.geometry) return;
      const wkb = geoJsonToWKB(f.geometry);
      const gpkgBlob = buildGpkgHeaderBlob(wkb);
      stmt.run([gpkgBlob, ...fields.map(field => f.properties[field] ?? '')]);
    });
    stmt.free();

    const data = db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${tableName}.gpkg`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(`Exported ${tableName}.gpkg successfully!`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus('Export failed: ' + err.message, 'error');
  }
}

/* Initial render */
renderLayerList();
renderRasterLayerList();
updateStatusLayerCount();

/* -----------------------------------------------------------
   Project save / open — layers, symbology, basemap, and view
   as a single portable .webgis.json file (no browser storage).
   Note: vector layers only — raster (GeoTIFF) layers are not yet
   included in project files.
----------------------------------------------------------- */
function buildProjectPayload() {
  return {
    format: 'webgis-project',
    appVersion: APP_VERSION,
    savedAt: new Date().toISOString(),
    basemap: state.basemapKey,
    view: { center: map.getCenter().toArray(), zoom: map.getZoom() },
    layers: state.layers.map(l => ({
      name: l.name, color: l.color, pointColor: l.pointColor, lineColor: l.lineColor, fillColor: l.fillColor,
      width: l.width, opacity: l.opacity, labelField: l.labelField, visible: l.visible, data: l.data
    }))
  };
}

els.saveProjectBtn.addEventListener('click', async () => {
  const name = await modalPrompt('Save project', 'Name this project file.', 'my_project');
  if (name === null) return;
  const payload = buildProjectPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(name || 'my_project').replace(/[^a-zA-Z0-9_-]/g, '_')}.webgis.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(`Saved project (${payload.layers.length} layer${payload.layers.length === 1 ? '' : 's'})`, 'ok');
});

els.openProjectBtn.addEventListener('click', () => els.projectInput.click());
els.projectInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!['webgis-project', 'webgis-studio-project'].includes(payload.format) || !Array.isArray(payload.layers)) {
      throw new Error('This file is not a recognised WebGIS project.');
    }

    if (state.layers.length) {
      const proceed = await modalConfirm('Replace current workspace?', 'Opening a project replaces every layer currently loaded. This cannot be undone.', { confirmLabel: 'Replace', danger: true });
      if (!proceed) { els.projectInput.value = ''; return; }
    }

    loadProjectData(payload);
    setStatus(`Opened project: ${file.name}`, 'ok');
    switchToTab('layers');
  } catch (err) {
    console.error(err);
    setStatus(`Could not open project: ${err.message}`, 'error');
  } finally {
    els.projectInput.value = '';
  }
});

function loadProjectData(payload) {
  [...state.layers].forEach(l => removeLayer(l.id));

  state.layers = payload.layers.map(saved => ({
    id: 'layer_' + Math.random().toString(36).substr(2, 8),
    name: saved.name, color: saved.color,
    pointColor: saved.pointColor || saved.color, lineColor: saved.lineColor || saved.color, fillColor: saved.fillColor || saved.color,
    width: saved.width, opacity: saved.opacity,
    labelField: saved.labelField || '', visible: saved.visible !== false, data: saved.data
  }));

  state.layers.forEach(layer => { renderLayerOnMap(layer); setLayerMapVisibility(layer, layer.visible); });

  if (payload.basemap) switchBasemap(payload.basemap);
  if (payload.view?.center) map.jumpTo({ center: payload.view.center, zoom: payload.view.zoom ?? map.getZoom() });

  setActiveLayer(state.layers[0]?.id || null);
  updateStatusLayerCount();
}
