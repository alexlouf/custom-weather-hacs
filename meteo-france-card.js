/**
 * Météo France Card - Custom Lovelace Card for Home Assistant
 * Displays Météo-France weather data with "pluie dans l'heure" rain timeline
 *
 * @version 1.2.0
 * @license MIT
 */

const CARD_VERSION = '1.2.0';

// Weather condition → emoji icon (same as the default HA weather card style)
const WEATHER_ICONS = {
    'clear-night': '🌙',
    'cloudy': '☁️',
    'fog': '🌫️',
    'hail': '🌨️',
    'lightning': '⛈️',
    'lightning-rainy': '⛈️',
    'partlycloudy': '⛅',
    'pouring': '🌧️',
    'rainy': '🌧️',
    'snowy': '❄️',
    'snowy-rainy': '🌨️',
    'sunny': '☀️',
    'windy': '💨',
    'windy-variant': '🌬️',
    'exceptional': '⚠️',
};

// French weather condition labels
const WEATHER_LABELS_FR = {
    'clear-night': 'Nuit dégagée',
    'cloudy': 'Nuageux',
    'fog': 'Brouillard',
    'hail': 'Grêle',
    'lightning': 'Orageux',
    'lightning-rainy': 'Orage et pluie',
    'partlycloudy': 'Partiellement nuageux',
    'pouring': 'Fortes pluies',
    'rainy': 'Pluvieux',
    'snowy': 'Neigeux',
    'snowy-rainy': 'Neige et pluie',
    'sunny': 'Ensoleillé',
    'windy': 'Venteux',
    'windy-variant': 'Venteux et nuageux',
    'exceptional': 'Exceptionnel',
};

const RAIN_DESC_MAP = {
    'Temps sec': 1,
    'Pluie faible': 2,
    'Pluie modérée': 3,
    'Pluie forte': 4,
};

const ALERT_COLORS = {
    'Vert': '#4CAF50', 'Jaune': '#FFC107', 'Orange': '#FF9800', 'Rouge': '#F44336',
};

const ALERT_TYPES = {
    'Vent violent': 'mdi:weather-windy',
    'Pluie-inondation': 'mdi:weather-pouring',
    'Orages': 'mdi:weather-lightning',
    'Inondation': 'mdi:home-flood',
    'Neige-verglas': 'mdi:snowflake-alert',
    'Canicule': 'mdi:thermometer-alert',
    'Grand Froid': 'mdi:snowflake',
    'Avalanches': 'mdi:image-filter-hdr',
    'Vagues-submersion': 'mdi:waves',
};

const WIND_DIRECTIONS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO','N'];

class MeteoFranceCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._config = {};
        this._hass = null;
        this._forecastSubscription = null;
        this._hourlyForecastSubscription = null;
        this._forecasts = [];
        this._hourlyForecasts = [];
    }

    static getConfigElement() { return document.createElement('meteo-france-card-editor'); }

    static getStubConfig() {
        return {
            entity: '', rain_forecast_entity: '', alert_entity: '', name: '',
            show_current: true, show_details: true, show_rain_forecast: true,
            show_alert: true, show_daily_forecast: true, show_hourly_forecast: true,
            number_of_daily_forecasts: 5, number_of_hourly_forecasts: 6,
        };
    }

    setConfig(config) {
        if (!config.entity) throw new Error('Veuillez définir une entité weather (entity)');
        this._config = {
            show_current: true, show_details: true, show_rain_forecast: true,
            show_alert: true, show_daily_forecast: true, show_hourly_forecast: true,
            number_of_daily_forecasts: 5, number_of_hourly_forecasts: 6,
            ...config,
        };
        this._render();
    }

    set hass(hass) {
        this._hass = hass;
        if (hass && !this._forecastSubscription) {
            this._subscribeForecast('daily');
            this._subscribeForecast('hourly');
        }
        this._render();
    }

    async _subscribeForecast(type) {
        if (!this._hass || !this._config.entity) return;
        try {
            const sub = await this._hass.connection.subscribeMessage((result) => {
                if (type === 'daily') this._forecasts = result?.forecast || [];
                else this._hourlyForecasts = result?.forecast || [];
                this._render();
            }, {
                type: 'weather/subscribe_forecast',
                forecast_type: type,
                entity_id: this._config.entity,
            });
            if (type === 'daily') this._forecastSubscription = sub;
            else this._hourlyForecastSubscription = sub;
        } catch (e) {
            console.warn(`MeteoFranceCard: Unable to subscribe to ${type} forecast:`, e);
        }
    }

    disconnectedCallback() {
        if (this._forecastSubscription) { this._forecastSubscription(); this._forecastSubscription = null; }
        if (this._hourlyForecastSubscription) { this._hourlyForecastSubscription(); this._hourlyForecastSubscription = null; }
    }

    getCardSize() {
        let s = 3;
        if (this._config.show_rain_forecast) s += 2;
        if (this._config.show_daily_forecast) s += 2;
        if (this._config.show_hourly_forecast) s += 2;
        return s;
    }

    // ── Helpers ────────────────────────────────────────────────────

    _entity() { return this._hass?.states[this._config.entity]; }
    _rainEntity() { return this._config.rain_forecast_entity ? this._hass?.states[this._config.rain_forecast_entity] : null; }
    _alertEntity() { return this._config.alert_entity ? this._hass?.states[this._config.alert_entity] : null; }
    _detailEntity(key) { return this._config[key] ? this._hass?.states[this._config[key]] : null; }

    _windDir(bearing) {
        if (bearing == null) return '';
        return WIND_DIRECTIONS[Math.round(bearing / 22.5)] || '';
    }

    _fmtTime(d) { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }

    _fmtDay(d) {
        const date = new Date(d), today = new Date(), tmrw = new Date(today);
        tmrw.setDate(tmrw.getDate() + 1);
        if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
        if (date.toDateString() === tmrw.toDateString()) return 'Demain';
        return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    }

    _icon(condition) { return WEATHER_ICONS[condition] || '☁️'; }

    // ── Rain ───────────────────────────────────────────────────────

    _parseRain() {
        const e = this._rainEntity();
        if (!e) return null;
        const fc = e.attributes['1_hour_forecast'], ref = e.attributes['forecast_time_ref'];
        if (!fc) return null;
        const entries = Object.entries(fc).map(([t, desc]) => ({
            minutes: parseInt(t), description: desc, intensity: RAIN_DESC_MAP[desc] || 1,
        })).sort((a, b) => a.minutes - b.minutes);
        return { refTime: ref, entries, hasRain: entries.some(e => e.intensity > 1) };
    }

    // ── Alerts ─────────────────────────────────────────────────────

    _parseAlerts() {
        const e = this._alertEntity();
        if (!e) return null;
        const alerts = [];
        for (const [k, v] of Object.entries(e.attributes)) {
            if (['Vent','Pluie','Orage','Inondation','Neige','Canicule','Grand','Avalanche','Vagues']
                .some(p => k.startsWith(p)) && v && v !== 'Vert') {
                alerts.push({ type: k, level: v });
            }
        }
        return { state: e.state, alerts };
    }

    // ── Render ─────────────────────────────────────────────────────

    _render() {
        if (!this._hass || !this._config.entity) return;
        const entity = this._entity();
        if (!entity) {
            this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px;color:var(--error-color)">Entité introuvable : ${this._config.entity}</div></ha-card>`;
            return;
        }

        const a = entity.attributes, state = entity.state;
        const name = this._config.name || a.friendly_name || 'Météo';
        const rain = this._parseRain(), alerts = this._parseAlerts();

        this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card>
        ${this._hHeader(name)}
        ${this._config.show_alert ? this._hAlerts(alerts) : ''}
        ${this._config.show_current ? this._hCurrent(state, a) : ''}
        ${this._config.show_details ? this._hDetails(a) : ''}
        ${this._config.show_rain_forecast ? this._hRain(rain) : ''}
        ${this._config.show_hourly_forecast ? this._hHourly() : ''}
        ${this._config.show_daily_forecast ? this._hDaily() : ''}
      </ha-card>
    `;
    }

    _hHeader(name) {
        return `<div class="card-header"><span class="header-title">${name}</span><span class="header-sub">Météo-France</span></div>`;
    }

    _hAlerts(data) {
        if (!data || !data.alerts.length) return '';
        return `<div class="alerts">${data.alerts.map(a => {
            const c = ALERT_COLORS[a.level] || '#FFC107', ic = ALERT_TYPES[a.type] || 'mdi:alert';
            return `<div class="alert-chip" style="--ac:${c}"><ha-icon icon="${ic}"></ha-icon><span>${a.type}</span><span class="alert-lvl">${a.level}</span></div>`;
        }).join('')}</div>`;
    }

    _hCurrent(state, a) {
        const temp = a.temperature != null ? Math.round(a.temperature) : '--';
        const unit = a.temperature_unit || '°C';
        const feel = a.apparent_temperature != null ? Math.round(a.apparent_temperature) : null;
        return `
      <div class="current">
        <div class="current-main">
          <span class="current-emoji">${this._icon(state)}</span>
          <div class="current-temp">
            <span class="temp-val">${temp}</span>
            <span class="temp-unit">${unit}</span>
          </div>
        </div>
        <div class="current-info">
          <div class="condition">${WEATHER_LABELS_FR[state] || state}</div>
          ${feel != null ? `<div class="feels-like">Ressenti ${feel}${unit}</div>` : ''}
        </div>
      </div>`;
    }

    _hDetails(a) {
        const d = [];
        if (a.humidity != null) d.push({ i: 'mdi:water-percent', l: 'Humidité', v: `${a.humidity}%` });
        if (a.pressure != null) d.push({ i: 'mdi:gauge', l: 'Pression', v: `${a.pressure} ${a.pressure_unit||'hPa'}` });
        if (a.wind_speed != null) d.push({ i: 'mdi:weather-windy', l: 'Vent', v: `${Math.round(a.wind_speed)} ${a.wind_speed_unit||'km/h'} ${this._windDir(a.wind_bearing)}` });
        if (a.wind_gust_speed != null) d.push({ i: 'mdi:weather-windy-variant', l: 'Rafales', v: `${Math.round(a.wind_gust_speed)} ${a.wind_speed_unit||'km/h'}` });
        if (a.visibility != null) d.push({ i: 'mdi:eye', l: 'Visibilité', v: `${a.visibility} ${a.visibility_unit||'km'}` });
        if (a.uv_index != null) d.push({ i: 'mdi:sun-wireless', l: 'UV', v: a.uv_index });
        if (a.cloud_coverage != null) d.push({ i: 'mdi:cloud', l: 'Nébulosité', v: `${a.cloud_coverage}%` });
        if (a.dew_point != null) d.push({ i: 'mdi:thermometer-water', l: 'Point de rosée', v: `${Math.round(a.dew_point)}°` });

        for (const {k, i, l} of [
            {k:'rain_chance_entity', i:'mdi:umbrella', l:'Risque pluie'},
            {k:'freeze_chance_entity', i:'mdi:snowflake', l:'Risque gel'},
            {k:'snow_chance_entity', i:'mdi:snowflake-variant', l:'Risque neige'},
        ]) { const e = this._detailEntity(k); if (e) d.push({ i, l, v: `${e.state}%` }); }
        const uv = this._detailEntity('uv_entity');
        if (uv && a.uv_index == null) d.push({ i: 'mdi:sun-wireless', l: 'UV', v: uv.state });

        if (!d.length) return '';
        return `<div class="details"><div class="details-grid">${d.map(x =>
            `<div class="detail"><ha-icon icon="${x.i}"></ha-icon><div class="detail-c"><span class="detail-l">${x.l}</span><span class="detail-v">${x.v}</span></div></div>`
        ).join('')}</div></div>`;
    }

    _hRain(rain) {
        if (!rain) {
            if (this._config.rain_forecast_entity)
                return `<div class="rain-section"><div class="section-t"><ha-icon icon="mdi:weather-rainy"></ha-icon><span>Pluie dans l'heure</span></div><div class="rain-na">Données indisponibles</div></div>`;
            return '';
        }

        const ref = rain.refTime ? this._fmtTime(rain.refTime) : '';
        const bars = rain.entries.map(e => {
            let c, h;
            switch(e.intensity) {
                case 1: c='var(--rain-dry,#555)'; h='8%'; break;
                case 2: c='var(--rain-light,#64B5F6)'; h='40%'; break;
                case 3: c='var(--rain-mod,#1E88E5)'; h='70%'; break;
                case 4: c='var(--rain-heavy,#0D47A1)'; h='100%'; break;
                default: c='var(--rain-dry,#555)'; h='8%';
            }
            return `<div class="bar-c" title="${e.description} (${e.minutes} min)"><div class="bar" style="height:${h};background:${c}"></div></div>`;
        }).join('');

        const status = rain.hasRain ? '🌧️ Pluie prévue dans l\'heure' : '☀️ Pas de pluie dans l\'heure';

        return `
      <div class="rain-section">
        <div class="section-t"><ha-icon icon="mdi:weather-rainy"></ha-icon><span>Pluie dans l'heure</span>${ref ? `<span class="section-time">${ref}</span>`:''}</div>
        <div class="rain-status ${rain.hasRain?'has-rain':'no-rain'}">${status}</div>
        <div class="rain-tl">
          <div class="bars">${bars}</div>
          <div class="bar-labels"><span>Maint.</span><span>+15 min</span><span>+30 min</span><span>+45 min</span><span>+60 min</span></div>
        </div>
        <div class="legend">
          <span class="leg"><span class="dot" style="background:var(--rain-dry,#555)"></span>Sec</span>
          <span class="leg"><span class="dot" style="background:var(--rain-light,#64B5F6)"></span>Faible</span>
          <span class="leg"><span class="dot" style="background:var(--rain-mod,#1E88E5)"></span>Modérée</span>
          <span class="leg"><span class="dot" style="background:var(--rain-heavy,#0D47A1)"></span>Forte</span>
        </div>
      </div>`;
    }

    _hHourly() {
        if (!this._hourlyForecasts?.length) return '';
        const fc = this._hourlyForecasts.slice(0, this._config.number_of_hourly_forecasts || 6);
        return `
      <div class="hourly"><div class="section-t"><ha-icon icon="mdi:clock-outline"></ha-icon><span>Prévisions horaires</span></div>
        <div class="hourly-scroll">${fc.map(f => {
            const t = f.temperature != null ? Math.round(f.temperature) : '--';
            const p = f.precipitation_probability != null ? `${f.precipitation_probability}%` : '';
            return `<div class="h-item">
            <span class="h-time">${this._fmtTime(f.datetime)}</span>
            <span class="h-emoji">${this._icon(f.condition)}</span>
            <span class="h-temp">${t}°</span>
            ${p ? `<span class="h-precip">☂ ${p}</span>` : ''}
          </div>`;
        }).join('')}</div>
      </div>`;
    }

    _hDaily() {
        if (!this._forecasts?.length) return '';
        const fc = this._forecasts.slice(0, this._config.number_of_daily_forecasts || 5);
        return `
      <div class="daily"><div class="section-t"><ha-icon icon="mdi:calendar-week"></ha-icon><span>Prévisions</span></div>
        ${fc.map(f => {
            const hi = f.temperature != null ? Math.round(f.temperature) : '--';
            const lo = f.templow != null ? Math.round(f.templow) : '--';
            const p = f.precipitation_probability != null ? `${f.precipitation_probability}%` : '';
            return `<div class="d-item">
            <span class="d-day">${this._fmtDay(f.datetime)}</span>
            <span class="d-emoji">${this._icon(f.condition)}</span>
            ${p ? `<span class="d-precip">☂ ${p}</span>` : '<span class="d-precip"></span>'}
            <span class="d-temps"><span class="d-hi">${hi}°</span><span class="d-lo">${lo}°</span></span>
          </div>`;
        }).join('')}
      </div>`;
    }

    // ── CSS ────────────────────────────────────────────────────────

    _css() { return `
    :host {
      --mf1: var(--primary-text-color, #212121);
      --mf2: var(--secondary-text-color, #727272);
      --mfa: var(--accent-color, #03A9F4);
      --mfd: var(--divider-color, rgba(0,0,0,0.12));
    }
    ha-card { overflow:hidden; border-radius: var(--ha-card-border-radius, 12px); }

    /* Header */
    .card-header { display:flex; justify-content:space-between; align-items:center; padding:16px 16px 8px; }
    .header-title { font-size:1.1em; font-weight:600; color:var(--mf1); }
    .header-sub { font-size:0.75em; font-weight:500; color:var(--mfa); text-transform:uppercase; letter-spacing:0.5px; opacity:0.8; }

    /* Alerts */
    .alerts { display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 8px; }
    .alert-chip {
      display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:16px;
      font-size:0.75em; font-weight:500;
      background: color-mix(in srgb, var(--ac) 15%, transparent);
      color: var(--ac); border: 1px solid color-mix(in srgb, var(--ac) 30%, transparent);
    }
    .alert-chip ha-icon { --mdc-icon-size:14px; }
    .alert-lvl { font-weight:700; }

    /* Current */
    .current { padding:8px 16px 16px; display:flex; align-items:center; gap:16px; }
    .current-main { display:flex; align-items:center; gap:12px; }
    .current-emoji { font-size:48px; line-height:1; }
    .current-temp { display:flex; align-items:flex-start; }
    .temp-val { font-size:3em; font-weight:300; line-height:1; color:var(--mf1); }
    .temp-unit { font-size:1.2em; color:var(--mf2); margin-top:6px; margin-left:2px; }
    .current-info { flex:1; text-align:right; }
    .condition { font-size:1em; font-weight:500; color:var(--mf1); }
    .feels-like { font-size:0.85em; color:var(--mf2); margin-top:2px; }

    /* Details */
    .details { padding:0 16px 12px; }
    .details-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
    .detail {
      display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:8px;
      background: color-mix(in srgb, var(--mf1) 4%, transparent);
    }
    .detail ha-icon { --mdc-icon-size:18px; color:var(--mf2); flex-shrink:0; }
    .detail-c { display:flex; flex-direction:column; min-width:0; }
    .detail-l { font-size:0.7em; color:var(--mf2); text-transform:uppercase; letter-spacing:0.3px; }
    .detail-v { font-size:0.85em; font-weight:500; color:var(--mf1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* Section titles */
    .section-t { display:flex; align-items:center; gap:6px; padding-bottom:8px; font-size:0.85em; font-weight:600; color:var(--mf2); }
    .section-t ha-icon { --mdc-icon-size:18px; }
    .section-time { margin-left:auto; font-weight:400; font-size:0.9em; opacity:0.7; }

    /* Rain */
    .rain-section {
      padding:12px 16px; margin:0 12px 12px; border-radius:12px;
      background: color-mix(in srgb, var(--mfa) 6%, transparent);
      border: 1px solid color-mix(in srgb, var(--mfa) 12%, transparent);
    }
    .rain-status { font-size:0.85em; font-weight:500; margin-bottom:10px; }
    .rain-status.no-rain { color:var(--success-color,#4CAF50); }
    .rain-status.has-rain { color:var(--warning-color,#FF9800); }
    .rain-tl { margin-bottom:8px; }
    .bars { display:flex; gap:2px; height:60px; align-items:flex-end; padding:0 4px; }
    .bar-c { flex:1; height:100%; display:flex; align-items:flex-end; cursor:pointer; }
    .bar { width:100%; border-radius:3px 3px 0 0; transition:height 0.3s ease; min-height:4px; }
    .bar-c:hover .bar { opacity:0.8; filter:brightness(1.1); }
    .bar-labels {
      display:flex; justify-content:space-between; padding:6px 0 0;
      font-size:0.65em; color:var(--mf2); border-top:1px solid var(--mfd); margin-top:4px;
    }
    .rain-na { font-size:0.85em; color:var(--mf2); font-style:italic; padding:8px 0; }
    .legend { display:flex; justify-content:center; gap:12px; font-size:0.7em; color:var(--mf2); }
    .leg { display:flex; align-items:center; gap:4px; }
    .dot { width:8px; height:8px; border-radius:2px; display:inline-block; }

    /* Hourly */
    .hourly { padding:12px 16px; border-top:1px solid var(--mfd); }
    .hourly-scroll { display:flex; gap:4px; overflow-x:auto; padding-bottom:4px; scrollbar-width:thin; }
    .hourly-scroll::-webkit-scrollbar { height:4px; }
    .hourly-scroll::-webkit-scrollbar-thumb { background:var(--mfd); border-radius:2px; }
    .h-item {
      display:flex; flex-direction:column; align-items:center; gap:4px;
      min-width:56px; padding:8px 6px; border-radius:10px;
      background: color-mix(in srgb, var(--mf1) 3%, transparent); flex-shrink:0;
    }
    .h-time { font-size:0.72em; font-weight:500; color:var(--mf2); }
    .h-emoji { font-size:22px; line-height:1; }
    .h-temp { font-size:0.9em; font-weight:600; color:var(--mf1); }
    .h-precip { font-size:0.65em; color:var(--mf2); }

    /* Daily */
    .daily { padding:12px 16px 16px; border-top:1px solid var(--mfd); }
    .d-item { display:flex; align-items:center; gap:8px; padding:7px 0; }
    .d-item:not(:last-child) { border-bottom:1px solid color-mix(in srgb, var(--mfd) 50%, transparent); }
    .d-day { font-size:0.85em; font-weight:500; color:var(--mf1); width:80px; flex-shrink:0; text-transform:capitalize; }
    .d-emoji { font-size:20px; line-height:1; flex-shrink:0; }
    .d-precip { font-size:0.75em; color:var(--mf2); width:48px; flex-shrink:0; }
    .d-temps { margin-left:auto; display:flex; gap:6px; font-size:0.9em; flex-shrink:0; }
    .d-hi { font-weight:600; color:var(--mf1); width:32px; text-align:right; }
    .d-lo { font-weight:400; color:var(--mf2); width:32px; text-align:right; }
  `;}
}

// ── Editor ───────────────────────────────────────────────────────

class MeteoFranceCardEditor extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this._config = {}; }
    set hass(h) { this._hass = h; }
    setConfig(c) { this._config = c; this._render(); }

    _render() {
        this.shadowRoot.innerHTML = `
      <style>
        .row { display:flex; flex-direction:column; gap:8px; margin-bottom:12px; }
        .row label { font-weight:500; font-size:0.9em; color:var(--primary-text-color); }
        .row input { padding:8px; border:1px solid var(--divider-color); border-radius:8px; background:var(--card-background-color); color:var(--primary-text-color); font-size:0.9em; }
        .chk { display:flex; align-items:center; gap:8px; }
        h3 { margin:16px 0 8px; font-size:0.95em; color:var(--primary-text-color); border-bottom:1px solid var(--divider-color); padding-bottom:4px; }
      </style>
      <h3>Entités principales</h3>
      <div class="row"><label>Entité météo (weather.*)</label><input type="text" id="entity" value="${this._config.entity||''}" placeholder="weather.saint_cyr_l_ecole"></div>
      <div class="row"><label>Pluie prochaine heure</label><input type="text" id="rain_forecast_entity" value="${this._config.rain_forecast_entity||''}" placeholder="sensor.saint_cyr_l_ecole_next_rain"></div>
      <div class="row"><label>Alertes météo</label><input type="text" id="alert_entity" value="${this._config.alert_entity||''}" placeholder="sensor.78_weather_alert"></div>
      <h3>Entités détail (optionnel)</h3>
      <div class="row"><label>Risque pluie</label><input type="text" id="rain_chance_entity" value="${this._config.rain_chance_entity||''}"></div>
      <div class="row"><label>Risque gel</label><input type="text" id="freeze_chance_entity" value="${this._config.freeze_chance_entity||''}"></div>
      <div class="row"><label>Risque neige</label><input type="text" id="snow_chance_entity" value="${this._config.snow_chance_entity||''}"></div>
      <div class="row"><label>UV</label><input type="text" id="uv_entity" value="${this._config.uv_entity||''}"></div>
      <h3>Affichage</h3>
      <div class="row"><label>Nom</label><input type="text" id="name" value="${this._config.name||''}"></div>
      <div class="row"><div class="chk"><input type="checkbox" id="show_current" ${this._config.show_current!==false?'checked':''}><label>Météo actuelle</label></div></div>
      <div class="row"><div class="chk"><input type="checkbox" id="show_details" ${this._config.show_details!==false?'checked':''}><label>Détails</label></div></div>
      <div class="row"><div class="chk"><input type="checkbox" id="show_rain_forecast" ${this._config.show_rain_forecast!==false?'checked':''}><label>Pluie dans l'heure</label></div></div>
      <div class="row"><div class="chk"><input type="checkbox" id="show_alert" ${this._config.show_alert!==false?'checked':''}><label>Alertes</label></div></div>
      <div class="row"><div class="chk"><input type="checkbox" id="show_hourly_forecast" ${this._config.show_hourly_forecast!==false?'checked':''}><label>Prévisions horaires</label></div></div>
      <div class="row"><div class="chk"><input type="checkbox" id="show_daily_forecast" ${this._config.show_daily_forecast!==false?'checked':''}><label>Prévisions journalières</label></div></div>
      <div class="row"><label>Nb prévisions horaires</label><input type="number" id="number_of_hourly_forecasts" min="1" max="24" value="${this._config.number_of_hourly_forecasts||6}"></div>
      <div class="row"><label>Nb jours prévision</label><input type="number" id="number_of_daily_forecasts" min="1" max="7" value="${this._config.number_of_daily_forecasts||5}"></div>
    `;

        ['entity','rain_forecast_entity','alert_entity','name','rain_chance_entity','freeze_chance_entity','snow_chance_entity','uv_entity'].forEach(id => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.addEventListener('change', () => { this._config = {...this._config, [id]: el.value}; this._fire(); });
        });
        ['show_current','show_details','show_rain_forecast','show_alert','show_hourly_forecast','show_daily_forecast'].forEach(id => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.addEventListener('change', () => { this._config = {...this._config, [id]: el.checked}; this._fire(); });
        });
        ['number_of_hourly_forecasts','number_of_daily_forecasts'].forEach(id => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.addEventListener('change', () => { this._config = {...this._config, [id]: parseInt(el.value)}; this._fire(); });
        });
    }

    _fire() {
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config }, bubbles: true, composed: true }));
    }
}

// ── Register ─────────────────────────────────────────────────────

customElements.define('meteo-france-card', MeteoFranceCard);
customElements.define('meteo-france-card-editor', MeteoFranceCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
    type: 'meteo-france-card',
    name: 'Carte Météo France',
    description: 'Carte météo avec données Météo-France et pluie dans l\'heure',
    preview: true,
});

console.info(
    `%c  METEO-FRANCE-CARD  %c  v${CARD_VERSION}  `,
    'color: white; background: #0288D1; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
    'color: #0288D1; background: #E1F5FE; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);
