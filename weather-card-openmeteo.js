/**
 * weather-card-openmeteo.js
 * Custom Lovelace Card für Home Assistant
 * Wetterdaten von Open-Meteo API (kostenlos, kein API-Key)
 *
 * Installation via HACS:
 *   1. HACS → Benutzerdefinierte Repositories → URL deines GitHub-Repos eingeben
 *      Kategorie: Lovelace → Hinzufügen → Installieren
 *   2. Ressource wird automatisch eingetragen:
 *      /hacsfiles/weather-card-openmeteo/weather-card-openmeteo.js
 *   3. Karte im Dashboard hinzufügen (YAML-Typ: custom:weather-card-openmeteo)
 */

class WeatherCardOpenMeteo extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._lat = 46.8189;
    this._lon = 15.0686;
    this._locationName = 'Deutschlandsberg';
    this._weatherData = null;
    this._loading = true;
    this._error = null;
    this._searchTimeout = null;
  }

  // ── Lovelace Editor-Integration ────────────────────────────────────────────

  static getConfigElement() {
    return document.createElement('weather-card-openmeteo-editor');
  }

  static getStubConfig() {
    return {
      location_name: 'Deutschlandsberg',
      lat: 46.8189,
      lon: 15.0686,
    };
  }

  // ── Lovelace lifecycle ──────────────────────────────────────────────────────

  setConfig(config) {
    this._config = config || {};
    this._lat          = parseFloat(this._config.lat)           || 46.8189;
    this._lon          = parseFloat(this._config.lon)           || 15.0686;
    this._locationName = this._config.location_name             || 'Deutschlandsberg';
    this._render();
    this._fetchWeather();
  }

  // hass-Setter wird von HA aufgerufen, wenn sich der Zustand ändert
  set hass(hass) {
    this._hass = hass;
  }

  // ── WMO-Wettercode-Mapping ──────────────────────────────────────────────────

  _getWeatherInfo(code, isDay = true) {
    const map = {
      0:  { icon: isDay ? '☀️' : '🌙', desc: 'Klar' },
      1:  { icon: isDay ? '🌤️' : '🌙', desc: 'Überwiegend klar' },
      2:  { icon: '⛅',  desc: 'Teilweise bewölkt' },
      3:  { icon: '☁️',  desc: 'Bedeckt' },
      45: { icon: '🌫️',  desc: 'Nebel' },
      48: { icon: '🌫️',  desc: 'Gefrierender Nebel' },
      51: { icon: '🌦️',  desc: 'Leichter Nieselregen' },
      53: { icon: '🌦️',  desc: 'Nieselregen' },
      55: { icon: '🌧️',  desc: 'Starker Nieselregen' },
      56: { icon: '🌧️',  desc: 'Gefrierender Nieselregen' },
      57: { icon: '🌧️',  desc: 'Starker gefrierender Nieselregen' },
      61: { icon: '🌧️',  desc: 'Leichter Regen' },
      63: { icon: '🌧️',  desc: 'Regen' },
      65: { icon: '🌧️',  desc: 'Starker Regen' },
      66: { icon: '🌧️',  desc: 'Gefrierender Regen' },
      67: { icon: '🌧️',  desc: 'Starker gefrierender Regen' },
      71: { icon: '🌨️',  desc: 'Leichter Schneefall' },
      73: { icon: '🌨️',  desc: 'Schneefall' },
      75: { icon: '❄️',   desc: 'Starker Schneefall' },
      77: { icon: '🌨️',  desc: 'Schneekörner' },
      80: { icon: '🌦️',  desc: 'Leichte Regenschauer' },
      81: { icon: '🌧️',  desc: 'Regenschauer' },
      82: { icon: '⛈️',  desc: 'Starke Regenschauer' },
      85: { icon: '🌨️',  desc: 'Leichte Schneeschauer' },
      86: { icon: '❄️',   desc: 'Schneeschauer' },
      95: { icon: '⛈️',  desc: 'Gewitter' },
      96: { icon: '⛈️',  desc: 'Gewitter mit leichtem Hagel' },
      99: { icon: '⛈️',  desc: 'Gewitter mit Hagel' },
    };
    return map[code] ?? { icon: '❓', desc: 'Unbekannt' };
  }

  // ── Hilfsfunktionen ─────────────────────────────────────────────────────────

  _getDayLabel(dateStr, index) {
    if (index === 0) return 'Heute';
    if (index === 1) return 'Morgen';
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const d = new Date(dateStr + 'T12:00:00');
    return days[d.getDay()];
  }

  _formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString('de-AT', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna'
    });
  }

  // ── API-Aufrufe ─────────────────────────────────────────────────────────────

  async _fetchWeather() {
    this._loading = true;
    this._error   = null;
    this._updateStatus();

    const params = new URLSearchParams({
      latitude:       this._lat,
      longitude:      this._lon,
      current:        'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,weather_code,is_day,precipitation',
      daily:          'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
      timezone:       'Europe/Vienna',
      forecast_days:  '5',
    });

    try {
      const res  = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._weatherData = await res.json();
      this._loading     = false;
      this._render();
    } catch (err) {
      console.error('[weather-card] Fetch-Fehler:', err);
      this._loading = false;
      this._error   = 'Wetterdaten konnten nicht geladen werden.';
      this._updateStatus();
    }
  }

  async _geocodeLocation(query) {
    if (!query.trim()) return;
    this._loading = true;
    this._error   = null;
    this._updateStatus();

    const params = new URLSearchParams({
      name:     query.trim(),
      count:    1,
      language: 'de',
      format:   'json',
    });

    try {
      const res  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.results?.length) {
        const r = data.results[0];
        this._lat          = r.latitude;
        this._lon          = r.longitude;
        this._locationName = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
        // Eingabefeld-Label aktualisieren
        const label = this.shadowRoot.getElementById('location-display');
        if (label) label.textContent = this._locationName;
        await this._fetchWeather();
      } else {
        this._loading = false;
        this._error   = `Ort „${query}" nicht gefunden. Bitte anderen Namen versuchen.`;
        this._updateStatus();
      }
    } catch (err) {
      console.error('[weather-card] Geocoding-Fehler:', err);
      this._loading = false;
      this._error   = 'Ortssuche fehlgeschlagen. Bitte erneut versuchen.';
      this._updateStatus();
    }
  }

  // ── Status-Anzeige (Ladeindikator / Fehlermeldung) ──────────────────────────

  _updateStatus() {
    const body = this.shadowRoot.getElementById('card-body');
    if (!body) return;

    if (this._loading) {
      body.innerHTML = `
        <div class="status">
          <div class="spinner"></div>
          <p>Wetterdaten werden geladen…</p>
        </div>`;
    } else if (this._error) {
      body.innerHTML = `
        <div class="status error">
          <span class="error-icon">⚠️</span>
          <p>${this._error}</p>
          <button class="retry-btn" id="retry-btn">Erneut versuchen</button>
        </div>`;
      this.shadowRoot.getElementById('retry-btn')
        ?.addEventListener('click', () => this._fetchWeather());
    }
  }

  // ── Haupt-Render ────────────────────────────────────────────────────────────

  _render() {
    const d = this._weatherData;

    this.shadowRoot.innerHTML = `
      <style>${this._getStyles()}</style>
      <ha-card>
        <!-- Kopfzeile -->
        <div class="card-header">
          <div class="header-top">
            <span class="header-icon">🌍</span>
            <span class="location-name">${this._locationName}</span>
            <button class="refresh-btn" id="refresh-btn" title="Aktualisieren">🔄</button>
          </div>
        </div>

        <!-- Karteninhalt (wird durch _updateStatus oder _renderBody ersetzt) -->
        <div id="card-body">
          ${d ? this._renderBody(d) : '<div class="status"><div class="spinner"></div><p>Wird geladen…</p></div>'}
        </div>

        <div class="card-footer">
          Daten: Open-Meteo.com &nbsp;|&nbsp; Aktualisiert: ${new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })} Uhr
        </div>
      </ha-card>
    `;

    this._bindEvents();
  }

  _renderBody(d) {
    const cur     = d.current;
    const daily   = d.daily;
    const weather = this._getWeatherInfo(cur.weather_code, cur.is_day === 1);

    const windDir = this._getWindDirection(cur.wind_direction_10m);

    let forecastHtml = '';
    for (let i = 0; i < daily.time.length; i++) {
      const fw = this._getWeatherInfo(daily.weather_code[i]);
      forecastHtml += `
        <div class="forecast-day">
          <div class="f-day">${this._getDayLabel(daily.time[i], i)}</div>
          <div class="f-icon">${fw.icon}</div>
          <div class="f-desc">${fw.desc}</div>
          <div class="f-temps">
            <span class="f-high">${Math.round(daily.temperature_2m_max[i])}°</span>
            <span class="f-sep">/</span>
            <span class="f-low">${Math.round(daily.temperature_2m_min[i])}°</span>
          </div>
          ${daily.precipitation_sum[i] > 0
            ? `<div class="f-precip">💧 ${daily.precipitation_sum[i].toFixed(1)} mm</div>`
            : '<div class="f-precip">&nbsp;</div>'}
        </div>`;
    }

    return `
      <!-- Aktuelles Wetter -->
      <div class="current-weather">
        <div class="current-main">
          <div class="current-icon">${weather.icon}</div>
          <div class="current-temp">${Math.round(cur.temperature_2m)}<span class="unit">°C</span></div>
        </div>
        <div class="current-desc">${weather.desc}</div>
        <div class="current-details">
          <div class="detail-item">
            <span class="detail-icon">🌡️</span>
            <span class="detail-label">Gefühlt</span>
            <span class="detail-value">${Math.round(cur.apparent_temperature)}°C</span>
          </div>
          <div class="detail-item">
            <span class="detail-icon">💧</span>
            <span class="detail-label">Luftfeuchte</span>
            <span class="detail-value">${cur.relative_humidity_2m} %</span>
          </div>
          <div class="detail-item">
            <span class="detail-icon">💨</span>
            <span class="detail-label">Wind</span>
            <span class="detail-value">${Math.round(cur.wind_speed_10m)} km/h ${windDir}</span>
          </div>
          <div class="detail-item">
            <span class="detail-icon">🌧️</span>
            <span class="detail-label">Niederschlag</span>
            <span class="detail-value">${cur.precipitation} mm</span>
          </div>
        </div>
      </div>

      <!-- 5-Tage-Vorhersage -->
      <div class="forecast-header">5-Tage-Vorhersage</div>
      <div class="forecast-row">
        ${forecastHtml}
      </div>
    `;
  }

  _getWindDirection(deg) {
    if (deg === undefined || deg === null) return '';
    const dirs = ['N','NO','O','SO','S','SW','W','NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  // ── Events binden ───────────────────────────────────────────────────────────

  _bindEvents() {
    const root = this.shadowRoot;
    root.getElementById('refresh-btn')?.addEventListener('click', () => this._fetchWeather());
  }

  // ── CSS ─────────────────────────────────────────────────────────────────────

  _getStyles() {
    return `
      :host {
        display: block;
        font-family: var(--primary-font-family, 'Segoe UI', Roboto, sans-serif);
      }

      ha-card {
        background: var(--card-background-color, #1c1c2e);
        border-radius: 16px;
        overflow: hidden;
        color: var(--primary-text-color, #e0e0e0);
        box-shadow: 0 4px 24px rgba(0,0,0,0.3);
      }

      /* ── Kopfzeile ── */
      .card-header {
        background: linear-gradient(135deg, #1a3a5c 0%, #0d2137 100%);
        padding: 14px 16px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .header-top {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .header-icon { font-size: 1.2em; }
      .location-name {
        flex: 1;
        font-size: 1.05em;
        font-weight: 600;
        color: #a8d4f5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .refresh-btn {
        background: rgba(255,255,255,0.1);
        border: none;
        border-radius: 8px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 0.95em;
        transition: background 0.2s;
        color: inherit;
      }
      .refresh-btn:hover {
        background: rgba(255,255,255,0.2);
      }

      /* ── Ladezustand / Fehler ── */
      .status {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        gap: 12px;
        color: #a0a0b0;
        font-size: 0.9em;
      }
      .status.error { color: #f08080; }
      .error-icon { font-size: 2em; }
      .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid rgba(168,212,245,0.2);
        border-top-color: #a8d4f5;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .retry-btn {
        margin-top: 8px;
        padding: 8px 18px;
        border-radius: 8px;
        border: 1px solid #f08080;
        background: transparent;
        color: #f08080;
        cursor: pointer;
        font-size: 0.85em;
        transition: background 0.2s;
      }
      .retry-btn:hover { background: rgba(240,128,128,0.15); }

      /* ── Aktuelles Wetter ── */
      .current-weather {
        padding: 20px 20px 12px;
        text-align: center;
      }
      .current-main {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .current-icon { font-size: 3.5em; line-height: 1; }
      .current-temp {
        font-size: 3.8em;
        font-weight: 700;
        color: #ffffff;
        line-height: 1;
      }
      .unit {
        font-size: 0.5em;
        font-weight: 400;
        color: #a8d4f5;
        vertical-align: super;
      }
      .current-desc {
        margin-top: 6px;
        font-size: 1.05em;
        color: #a8d4f5;
        font-weight: 500;
      }
      .current-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 16px;
        padding: 14px;
        background: rgba(255,255,255,0.05);
        border-radius: 12px;
      }
      .detail-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.88em;
      }
      .detail-icon { font-size: 1.1em; }
      .detail-label { color: #8090a0; flex: 1; }
      .detail-value { font-weight: 600; color: #c8dff0; }

      /* ── Vorhersage ── */
      .forecast-header {
        padding: 4px 20px 8px;
        font-size: 0.78em;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #607080;
        font-weight: 600;
      }
      .forecast-row {
        display: flex;
        gap: 0;
        padding: 0 12px 12px;
        overflow-x: auto;
      }
      .forecast-day {
        flex: 1;
        min-width: 70px;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 6px;
        border-radius: 12px;
        gap: 4px;
        transition: background 0.2s;
      }
      .forecast-day:hover {
        background: rgba(255,255,255,0.06);
      }
      .f-day {
        font-size: 0.82em;
        font-weight: 700;
        color: #a8d4f5;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .f-icon { font-size: 1.8em; line-height: 1.2; }
      .f-desc {
        font-size: 0.68em;
        color: #708090;
        text-align: center;
        min-height: 2.4em;
        display: flex;
        align-items: center;
      }
      .f-temps {
        display: flex;
        gap: 3px;
        align-items: baseline;
        font-size: 0.9em;
      }
      .f-high { font-weight: 700; color: #ff9966; }
      .f-sep  { color: #506070; }
      .f-low  { color: #66aaff; }
      .f-precip {
        font-size: 0.72em;
        color: #6090b0;
        min-height: 1.4em;
      }

      /* ── Footer ── */
      .card-footer {
        padding: 8px 16px;
        text-align: center;
        font-size: 0.72em;
        color: #405060;
        border-top: 1px solid rgba(255,255,255,0.05);
        background: rgba(0,0,0,0.15);
      }
    `;
  }
}

// ── Grafischer Karten-Editor ──────────────────────────────────────────────────

class WeatherCardOpenMeteoEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._searching = false;
    this._results = [];
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _fireChanged(patch) {
    this._config = { ...this._config, ...patch };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  async _search(query) {
    if (!query.trim()) return;
    this._searching = true;
    this._results = [];
    this._renderResults();

    const params = new URLSearchParams({
      name: query.trim(), count: 5, language: 'de', format: 'json',
    });
    try {
      const res  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
      const data = await res.json();
      this._results = data.results || [];
    } catch {
      this._results = [];
    }
    this._searching = false;
    this._renderResults();
  }

  _renderResults() {
    const list = this.shadowRoot.getElementById('results');
    if (!list) return;

    if (this._searching) {
      list.innerHTML = `<div class="hint">Suche läuft…</div>`;
      return;
    }
    if (!this._results.length) {
      list.innerHTML = `<div class="hint">Keine Ergebnisse.</div>`;
      return;
    }

    list.innerHTML = this._results.map((r, i) => `
      <div class="result-item" data-index="${i}">
        <span class="r-name">${r.name}</span>
        <span class="r-info">${[r.admin1, r.country].filter(Boolean).join(', ')}</span>
        <span class="r-coords">${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</span>
      </div>
    `).join('');

    list.querySelectorAll('.result-item').forEach(el => {
      el.addEventListener('click', () => {
        const r = this._results[parseInt(el.dataset.index)];
        const name = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
        this._fireChanged({ location_name: name, lat: r.latitude, lon: r.longitude });
        list.innerHTML = '';
        this.shadowRoot.getElementById('search-input').value = '';
        this._render();
      });
    });
  }

  _render() {
    const c = this._config;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: var(--primary-font-family, sans-serif); }
        .editor { padding: 4px 0; display: flex; flex-direction: column; gap: 14px; }

        label { font-size: 0.82em; color: var(--secondary-text-color, #888); margin-bottom: 3px; display: block; }

        .field { display: flex; flex-direction: column; }

        input[type="text"], input[type="number"] {
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--divider-color, #444);
          background: var(--card-background-color, #1c1c2e);
          color: var(--primary-text-color, #e0e0e0);
          font-size: 0.95em;
          width: 100%;
          box-sizing: border-box;
          outline: none;
        }
        input:focus { border-color: var(--primary-color, #03a9f4); }

        .coords { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .search-row { display: flex; gap: 8px; }
        .search-row input { flex: 1; }
        button {
          padding: 8px 14px;
          border-radius: 8px;
          border: none;
          background: var(--primary-color, #03a9f4);
          color: #fff;
          cursor: pointer;
          font-size: 0.9em;
          white-space: nowrap;
        }
        button:hover { opacity: 0.85; }

        #results { margin-top: 4px; }
        .result-item {
          display: flex;
          align-items: baseline;
          gap: 6px;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .result-item:hover { background: var(--secondary-background-color, rgba(255,255,255,0.06)); }
        .r-name { font-weight: 600; font-size: 0.95em; }
        .r-info { flex: 1; font-size: 0.82em; color: var(--secondary-text-color, #888); }
        .r-coords { font-size: 0.75em; color: var(--disabled-text-color, #666); }
        .hint { padding: 6px 10px; font-size: 0.85em; color: var(--secondary-text-color, #888); }

        .current-location {
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--secondary-background-color, rgba(255,255,255,0.05));
          font-size: 0.88em;
        }
        .current-location strong { color: var(--primary-text-color, #e0e0e0); }
        .current-location span { color: var(--secondary-text-color, #888); font-size: 0.9em; }

        .divider {
          border: none;
          border-top: 1px solid var(--divider-color, rgba(255,255,255,0.08));
        }
      </style>

      <div class="editor">
        <!-- Aktueller Standort -->
        <div class="current-location">
          📍 <strong>${c.location_name || '—'}</strong><br>
          <span>Lat: ${c.lat ?? '—'} &nbsp; Lon: ${c.lon ?? '—'}</span>
        </div>

        <hr class="divider">

        <!-- Ortssuche -->
        <div class="field">
          <label>Ort suchen</label>
          <div class="search-row">
            <input type="text" id="search-input" placeholder="z. B. Graz, Wien, Berlin…" autocomplete="off" />
            <button id="search-btn">Suchen</button>
          </div>
          <div id="results"></div>
        </div>

        <hr class="divider">

        <!-- Manuelle Felder -->
        <div class="field">
          <label>Angezeigter Ortsname</label>
          <input type="text" id="loc-name" value="${c.location_name || ''}" placeholder="z. B. Deutschlandsberg" />
        </div>
        <div class="coords">
          <div class="field">
            <label>Breitengrad (Lat)</label>
            <input type="number" id="lat" value="${c.lat ?? ''}" step="0.0001" placeholder="46.8189" />
          </div>
          <div class="field">
            <label>Längengrad (Lon)</label>
            <input type="number" id="lon" value="${c.lon ?? ''}" step="0.0001" placeholder="15.0686" />
          </div>
        </div>
      </div>
    `;

    // Events
    const root = this.shadowRoot;

    root.getElementById('search-btn').addEventListener('click', () => {
      const q = root.getElementById('search-input').value;
      if (q) this._search(q);
    });
    root.getElementById('search-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._search(e.target.value); }
    });

    root.getElementById('loc-name').addEventListener('change', e =>
      this._fireChanged({ location_name: e.target.value }));
    root.getElementById('lat').addEventListener('change', e =>
      this._fireChanged({ lat: parseFloat(e.target.value) }));
    root.getElementById('lon').addEventListener('change', e =>
      this._fireChanged({ lon: parseFloat(e.target.value) }));
  }
}

// Custom Elements registrieren
if (!customElements.get('weather-card-openmeteo')) {
  customElements.define('weather-card-openmeteo', WeatherCardOpenMeteo);
}
if (!customElements.get('weather-card-openmeteo-editor')) {
  customElements.define('weather-card-openmeteo-editor', WeatherCardOpenMeteoEditor);
}

// Karte in Lovelace-Custom-Card-Liste eintragen (für den UI-Editor)
window.customCards = window.customCards || [];
window.customCards.push({
  type:        'weather-card-openmeteo',
  name:        'Wetterkarte (Open-Meteo)',
  description: 'Aktuelle Wetterdaten und 5-Tage-Vorhersage von Open-Meteo – kein API-Key erforderlich.',
  preview:     false,
});
