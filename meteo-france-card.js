
/**
 * Météo France Card - Custom Lovelace Card for Home Assistant
 * Displays Météo-France weather data with "pluie dans l'heure" rain timeline
 * Compact mode with popups on click
 *
 * @version 2.0.0
 * @license MIT
 */

const CARD_VERSION = '2.0.0';

// Weather condition → emoji icon
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
        this._activePopup = null;
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

    getCardSize() { return 3; }

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

    // ── Popup management ───────────────────────────────────────────

    _showPopup(popupId) {
        this._activePopup = popupId;
        this._render();
        // Add closing animation listener
        requestAnimationFrame(() => {
            const overlay = this.shadowRoot.querySelector('.popup-overlay');
            if (overlay) overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this._closePopup();
            });
            const closeBtn = this.shadowRoot.querySelector('.popup-close');
            if (closeBtn) closeBtn.addEventListener('click', () => this._closePopup());
        });
    }

    _closePopup() {
        const popup = this.shadowRoot.querySelector('.popup-content');
        const overlay = this.shadowRoot.querySelector('.popup-overlay');
        if (popup) popup.classList.add('closing');
        if (overlay) overlay.classList.add('closing');
        setTimeout(() => {
            this._activePopup = null;
            this._render();
        }, 200);
    }

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
        ${this._hCompactView(name, state, a, rain, alerts)}
        ${this._activePopup ? this._hPopup(state, a, rain, alerts) : ''}
      </ha-card>
    `;

        this._bindEvents();
    }

    _bindEvents() {
        this.shadowRoot.querySelectorAll('[data-popup]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this._showPopup(el.dataset.popup);
            });
        });
    }

    // ── Compact View (main card) ───────────────────────────────────

    _hCompactView(name, state, a, rain, alerts) {
        const temp = a.temperature != null ? Math.round(a.temperature) : '--';
        const unit = a.temperature_unit || '°C';
        const feel = a.apparent_temperature != null ? Math.round(a.apparent_temperature) : null;
        const hasAlerts = alerts && alerts.alerts.length > 0;

        // Compact rain summary
        let rainSummary = '';
        if (this._config.show_rain_forecast && rain) {
            rainSummary = rain.hasRain
                ? `<span class="chip chip-rain has-rain" data-popup="rain">🌧️ Pluie prévue</span>`
                : `<span class="chip chip-rain no-rain" data-popup="rain">☀️ Sec</span>`;
        } else if (this._config.show_rain_forecast && this._config.rain_forecast_entity) {
            rainSummary = `<span class="chip chip-rain" data-popup="rain">🌧️ N/A</span>`;
        }

        // Compact hourly summary (next 3 hours)
        let hourlySummary = '';
        if (this._config.show_hourly_forecast && this._hourlyForecasts?.length) {
            const next3 = this._hourlyForecasts.slice(0, 3);
            hourlySummary = `<span class="chip chip-hourly" data-popup="hourly">${next3.map(f =>
                `<span class="mini-h">${this._fmtTime(f.datetime).replace(':','h').slice(0,-1)} ${this._icon(f.condition)} ${Math.round(f.temperature)}°</span>`
            ).join('')}<span class="chip-more">›</span></span>`;
        }

        // Compact daily summary (next 2 days)
        let dailySummary = '';
        if (this._config.show_daily_forecast && this._forecasts?.length) {
            const next2 = this._forecasts.slice(0, 2);
            dailySummary = `<span class="chip chip-daily" data-popup="daily">${next2.map(f =>
                `<span class="mini-d">${this._fmtDay(f.datetime).slice(0,3)} ${this._icon(f.condition)} ${Math.round(f.templow||0)}°/${Math.round(f.temperature)}°</span>`
            ).join('')}<span class="chip-more">›</span></span>`;
        }

        // Alert chips
        let alertChips = '';
        if (this._config.show_alert && hasAlerts) {
            alertChips = alerts.alerts.map(al => {
                const c = ALERT_COLORS[al.level] || '#FFC107';
                const ic = ALERT_TYPES[al.type] || 'mdi:alert';
                return `<span class="chip chip-alert" style="--ac:${c}" data-popup="alerts"><ha-icon icon="${ic}"></ha-icon>${al.level}</span>`;
            }).join('');
        }

        // Detail summary chips
        let detailChips = '';
        if (this._config.show_details) {
            const chips = [];
            if (a.humidity != null) chips.push(`💧${a.humidity}%`);
            if (a.wind_speed != null) chips.push(`💨${Math.round(a.wind_speed)}km/h`);
            const rainChance = this._detailEntity('rain_chance_entity');
            if (rainChance) chips.push(`☂${rainChance.state}%`);
            if (chips.length)
                detailChips = `<span class="chip chip-details" data-popup="details">${chips.join(' · ')}<span class="chip-more">›</span></span>`;
        }

        return `
      <div class="compact-card">
        <div class="compact-header">
          <span class="compact-name">${name}</span>
          <span class="compact-source">Météo-France</span>
        </div>
        <div class="compact-main" data-popup="current">
          <span class="compact-emoji">${this._icon(state)}</span>
          <div class="compact-temp-block">
            <span class="compact-temp">${temp}<span class="compact-unit">${unit}</span></span>
            <span class="compact-cond">${WEATHER_LABELS_FR[state] || state}${feel != null ? ` · Ressenti ${feel}°` : ''}</span>
          </div>
          ${hasAlerts ? `<div class="compact-alert-badge" data-popup="alerts">⚠️</div>` : ''}
        </div>
        <div class="compact-chips">
          ${alertChips}
          ${rainSummary}
          ${detailChips}
          ${hourlySummary}
          ${dailySummary}
        </div>
      </div>`;
    }

    // ── Popup ──────────────────────────────────────────────────────

    _hPopup(state, a, rain, alerts) {
        let title = '', content = '';
        switch(this._activePopup) {
            case 'current':
                title = 'Météo actuelle';
                content = this._popCurrent(state, a);
                break;
            case 'details':
                title = 'Détails';
                content = this._popDetails(a);
                break;
            case 'rain':
                title = 'Pluie dans l\'heure';
                content = this._popRain(rain);
                break;
            case 'alerts':
                title = 'Alertes météo';
                content = this._popAlerts(alerts);
                break;
            case 'hourly':
                title = 'Prévisions horaires';
                content = this._popHourly();
                break;
            case 'daily':
                title = 'Prévisions journalières';
                content = this._popDaily();
                break;
        }
        return `
      <div class="popup-overlay">
        <div class="popup-content">
          <div class="popup-header">
            <span class="popup-title">${title}</span>
            <span class="popup-close">✕</span>
          </div>
          <div class="popup-body">${content}</div>
        </div>
      </div>`;
    }

    _popCurrent(state, a) {
        const temp = a.temperature != null ? Math.round(a.temperature) : '--';
        const unit = a.temperature_unit || '°C';
        const feel = a.apparent_temperature != null ? Math.round(a.apparent_temperature) : null;
        return `
      <div class="pop-current">
        <div class="pop-current-main">
          <span class="pop-emoji">${this._icon(state)}</span>
          <div>
            <div class="pop-temp">${temp}<span class="pop-unit">${unit}</span></div>
            <div class="pop-cond">${WEATHER_LABELS_FR[state] || state}</div>
            ${feel != null ? `<div class="pop-feel">Ressenti ${feel}${unit}</div>` : ''}
          </div>
        </div>
        ${this._popDetails(a)}
      </div>`;
    }

    _popDetails(a) {
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

        if (!d.length) return '<div class="pop-empty">Aucun détail disponible</div>';
        return `<div class="pop-details-grid">${d.map(x =>
            `<div class="pop-detail"><ha-icon icon="${x.i}"></ha-icon><div class="pop-detail-c"><span class="pop-detail-l">${x.l}</span><span class="pop-detail-v">${x.v}</span></div></div>`
        ).join('')}</div>`;
    }

    _popRain(rain) {
        if (!rain) return '<div class="pop-empty">Données indisponibles pour la pluie dans l\'heure</div>';

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
            return `<div class="bar-c" title="${e.description} (${e.minutes} min)"><div class="bar" style="height:${h};background:${c}"></div><span class="bar-min">${e.minutes}'</span></div>`;
        }).join('');

        const status = rain.hasRain ? '🌧️ Pluie prévue dans l\'heure' : '☀️ Pas de pluie dans l\'heure';

        return `
      <div class="pop-rain">
        <div class="rain-status ${rain.hasRain?'has-rain':'no-rain'}">${status}</div>
        ${ref ? `<div class="rain-ref">Mis à jour : ${ref}</div>` : ''}
        <div class="rain-tl">
          <div class="bars">${bars}</div>
          <div class="bar-labels"><span>Maint.</span><span>+15'</span><span>+30'</span><span>+45'</span><span>+60'</span></div>
        </div>
        <div class="legend">
          <span class="leg"><span class="dot" style="background:var(--rain-dry,#555)"></span>Sec</span>
          <span class="leg"><span class="dot" style="background:var(--rain-light,#64B5F6)"></span>Faible</span>
          <span class="leg"><span class="dot" style="background:var(--rain-mod,#1E88E5)"></span>Modérée</span>
          <span class="leg"><span class="dot" style="background:var(--rain-heavy,#0D47A1)"></span>Forte</span>
        </div>
      </div>`;
    }

    _popAlerts(alerts) {
        if (!alerts || !alerts.alerts.length) return '<div class="pop-empty">Aucune alerte en cours</div>';
        return `<div class="pop-alerts">${alerts.alerts.map(a => {
            const c = ALERT_COLORS[a.level] || '#FFC107';
            const ic = ALERT_TYPES[a.type] || 'mdi:alert';
            return `<div class="pop-alert-item" style="--ac:${c}">
          <ha-icon icon="${ic}"></ha-icon>
          <div class="pop-alert-info">
            <span class="pop-alert-type">${a.type}</span>
            <span class="pop-alert-level">Vigilance ${a.level}</span>
          </div>
          <span class="pop-alert-badge">${a.level}</span>
        </div>`;
        }).join('')}</div>`;
    }

    _popHourly() {
        if (!this._hourlyForecasts?.length) return '<div class="pop-empty">Prévisions horaires indisponibles</div>';
        const fc = this._hourlyForecasts.slice(0, this._config.number_of_hourly_forecasts || 6);
        return `<div class="pop-hourly-grid">${fc.map(f => {
            const t = f.temperature != null ? Math.round(f.temperature) : '--';
            const p = f.precipitation_probability != null ? `${f.precipitation_probability}%` : '';
            const w = f.wind_speed != null ? `${Math.round(f.wind_speed)} km/h` : '';
            return `<div class="pop-h-item">
          <span class="pop-h-time">${this._fmtTime(f.datetime)}</span>
          <span class="pop-h-emoji">${this._icon(f.condition)}</span>
          <span class="pop-h-temp">${t}°</span>
          ${p ? `<span class="pop-h-precip">☂ ${p}</span>` : '<span class="pop-h-precip"></span>'}
          ${w ? `<span class="pop-h-wind">💨 ${w}</span>` : ''}
        </div>`;
        }).join('')}</div>`;
    }

    _popDaily() {
        if (!this._forecasts?.length) return '<div class="pop-empty">Prévisions journalières indisponibles</div>';
        const fc = this._forecasts.slice(0, this._config.number_of_daily_forecasts || 5);
        return `<div class="pop-daily-list">${fc.map(f => {
            const hi = f.temperature != null ? Math.round(f.temperature) : '--';
            const lo = f.templow != null ? Math.round(f.templow) : '--';
            const p = f.precipitation_probability != null ? `${f.precipitation_probability}%` : '';
            return `<div class="pop-d-item">
          <span class="pop-d-day">${this._fmtDay(f.datetime)}</span>
          <span class="pop-d-emoji">${this._icon(f.condition)}</span>
          <span class="pop-d-cond">${WEATHER_LABELS_FR[f.condition] || f.condition}</span>
          ${p ? `<span class="pop-d-precip">☂ ${p}</span>` : '<span class="pop-d-precip"></span>'}
          <span class="pop-d-temps"><span class="pop-d-hi">${hi}°</span><span class="pop-d-lo">${lo}°</span></span>
        </div>`;
        }).join('')}</div>`;
    }

    // ── CSS ────────────────────────────────────────────────────────

    _css() { return `
    :host {
      --mf1: var(--primary-text-color, #212121);
      --mf2: var(--secondary-text-color, #727272);
      --mfa: var(--accent-color, #03A9F4);
      --mfd: var(--divider-color, rgba(0,0,0,0.12));
    }
    ha-card { overflow:visible; border-radius:var(--ha-card-border-radius, 12px); position:relative; }

    /* ── Compact Card ── */
    .compact-card { padding:12px 16px; }

    .compact-header {
      display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;
    }
    .compact-name { font-size:0.95em; font-weight:600; color:var(--mf1); }
    .compact-source { font-size:0.65em; font-weight:500; color:var(--mfa); text-transform:uppercase; letter-spacing:0.5px; opacity:0.7; }

    .compact-main {
      display:flex; align-items:center; gap:12px; cursor:pointer;
      padding:8px 10px; border-radius:12px; transition:background 0.2s;
      position:relative;
    }
    .compact-main:hover { background:color-mix(in srgb, var(--mf1) 5%, transparent); }
    .compact-main:active { background:color-mix(in srgb, var(--mf1) 8%, transparent); }

    .compact-emoji {
      font-size:36px; line-height:1;
      font-family:"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif;
    }
    .compact-temp-block { display:flex; flex-direction:column; }
    .compact-temp { font-size:1.8em; font-weight:300; line-height:1; color:var(--mf1); }
    .compact-unit { font-size:0.45em; color:var(--mf2); vertical-align:super; }
    .compact-cond { font-size:0.78em; color:var(--mf2); margin-top:2px; }

    .compact-alert-badge {
      position:absolute; right:8px; top:50%; transform:translateY(-50%);
      font-size:18px; cursor:pointer; animation:pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }

    /* ── Chips row ── */
    .compact-chips {
      display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;
    }
    .chip {
      display:inline-flex; align-items:center; gap:4px; padding:4px 10px;
      border-radius:20px; font-size:0.72em; font-weight:500; cursor:pointer;
      transition:all 0.2s; user-select:none;
    }
    .chip:hover { filter:brightness(0.95); transform:translateY(-1px); }
    .chip:active { transform:translateY(0); }

    .chip-rain {
      background:color-mix(in srgb, var(--mfa) 10%, transparent);
      color:var(--mfa); border:1px solid color-mix(in srgb, var(--mfa) 20%, transparent);
    }
    .chip-rain.has-rain {
      background:color-mix(in srgb, var(--warning-color,#FF9800) 12%, transparent);
      color:var(--warning-color,#FF9800); border-color:color-mix(in srgb, var(--warning-color,#FF9800) 25%, transparent);
    }
    .chip-rain.no-rain {
      background:color-mix(in srgb, var(--success-color,#4CAF50) 10%, transparent);
      color:var(--success-color,#4CAF50); border-color:color-mix(in srgb, var(--success-color,#4CAF50) 20%, transparent);
    }
    .chip-alert {
      background:color-mix(in srgb, var(--ac) 15%, transparent);
      color:var(--ac); border:1px solid color-mix(in srgb, var(--ac) 30%, transparent);
    }
    .chip-alert ha-icon { --mdc-icon-size:13px; }

    .chip-details {
      background:color-mix(in srgb, var(--mf1) 5%, transparent);
      color:var(--mf2); border:1px solid color-mix(in srgb, var(--mf1) 8%, transparent);
    }
    .chip-hourly, .chip-daily {
      background:color-mix(in srgb, var(--mf1) 4%, transparent);
      color:var(--mf2); border:1px solid color-mix(in srgb, var(--mf1) 8%, transparent);
      gap:8px;
    }
    .mini-h, .mini-d { white-space:nowrap; font-size:0.95em; }
    .mini-h + .mini-h, .mini-d + .mini-d { padding-left:6px; border-left:1px solid var(--mfd); }

    .chip-more { font-size:1.2em; opacity:0.5; margin-left:2px; font-weight:700; }

    /* ── Popup Overlay ── */
    .popup-overlay {
      position:fixed; top:0; left:0; right:0; bottom:0;
      background:rgba(0,0,0,0.5); z-index:999;
      display:flex; align-items:center; justify-content:center;
      animation:fadeIn 0.2s ease;
      backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px);
    }
    .popup-overlay.closing { animation:fadeOut 0.2s ease forwards; }

    .popup-content {
      background:var(--card-background-color, #fff);
      border-radius:16px; width:90%; max-width:380px; max-height:80vh;
      overflow:hidden; display:flex; flex-direction:column;
      box-shadow:0 8px 32px rgba(0,0,0,0.25);
      animation:slideUp 0.25s ease;
    }
    .popup-content.closing { animation:slideDown 0.2s ease forwards; }

    @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }
    @keyframes fadeOut { from{opacity:1;} to{opacity:0;} }
    @keyframes slideUp { from{transform:translateY(30px);opacity:0;} to{transform:translateY(0);opacity:1;} }
    @keyframes slideDown { from{transform:translateY(0);opacity:1;} to{transform:translateY(30px);opacity:0;} }

    .popup-header {
      display:flex; justify-content:space-between; align-items:center;
      padding:16px 20px 12px; border-bottom:1px solid var(--mfd);
    }
    .popup-title { font-size:1em; font-weight:600; color:var(--mf1); }
    .popup-close {
      width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center;
      cursor:pointer; font-size:14px; color:var(--mf2);
      background:color-mix(in srgb, var(--mf1) 6%, transparent);
      transition:background 0.15s;
    }
    .popup-close:hover { background:color-mix(in srgb, var(--mf1) 12%, transparent); }

    .popup-body { padding:16px 20px 20px; overflow-y:auto; }

    .pop-empty { font-size:0.85em; color:var(--mf2); font-style:italic; text-align:center; padding:20px 0; }

    /* ── Popup: Current ── */
    .pop-current-main { display:flex; align-items:center; gap:16px; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--mfd); }
    .pop-emoji {
      font-size:48px; line-height:1;
      font-family:"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif;
    }
    .pop-temp { font-size:2.5em; font-weight:300; line-height:1; color:var(--mf1); }
    .pop-unit { font-size:0.4em; color:var(--mf2); vertical-align:super; }
    .pop-cond { font-size:0.95em; font-weight:500; color:var(--mf1); margin-top:4px; }
    .pop-feel { font-size:0.82em; color:var(--mf2); margin-top:2px; }

    /* ── Popup: Details grid ── */
    .pop-details-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
    .pop-detail {
      display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:10px;
      background:color-mix(in srgb, var(--mf1) 4%, transparent);
    }
    .pop-detail ha-icon { --mdc-icon-size:18px; color:var(--mf2); flex-shrink:0; }
    .pop-detail-c { display:flex; flex-direction:column; min-width:0; }
    .pop-detail-l { font-size:0.65em; color:var(--mf2); text-transform:uppercase; letter-spacing:0.3px; }
    .pop-detail-v { font-size:0.85em; font-weight:500; color:var(--mf1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* ── Popup: Rain ── */
    .pop-rain {}
    .rain-status { font-size:0.9em; font-weight:500; margin-bottom:8px; text-align:center; }
    .rain-status.no-rain { color:var(--success-color,#4CAF50); }
    .rain-status.has-rain { color:var(--warning-color,#FF9800); }
    .rain-ref { font-size:0.72em; color:var(--mf2); text-align:center; margin-bottom:12px; }
    .rain-tl { margin-bottom:12px; }
    .bars { display:flex; gap:3px; height:70px; align-items:flex-end; padding:0 4px; }
    .bar-c { flex:1; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; cursor:pointer; gap:3px; }
    .bar { width:100%; border-radius:3px 3px 0 0; transition:height 0.3s ease; min-height:4px; }
    .bar-min { font-size:0.55em; color:var(--mf2); }
    .bar-c:hover .bar { opacity:0.8; filter:brightness(1.1); }
    .bar-labels {
      display:flex; justify-content:space-between; padding:6px 0 0;
      font-size:0.65em; color:var(--mf2); border-top:1px solid var(--mfd); margin-top:4px;
    }
    .legend { display:flex; justify-content:center; gap:12px; font-size:0.7em; color:var(--mf2); }
    .leg { display:flex; align-items:center; gap:4px; }
    .dot { width:8px; height:8px; border-radius:2px; display:inline-block; }

    /* ── Popup: Alerts ── */
    .pop-alerts { display:flex; flex-direction:column; gap:8px; }
    .pop-alert-item {
      display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px;
      background:color-mix(in srgb, var(--ac) 8%, transparent);
      border:1px solid color-mix(in srgb, var(--ac) 20%, transparent);
    }
    .pop-alert-item ha-icon { --mdc-icon-size:22px; color:var(--ac); }
    .pop-alert-info { display:flex; flex-direction:column; flex:1; }
    .pop-alert-type { font-size:0.85em; font-weight:600; color:var(--mf1); }
    .pop-alert-level { font-size:0.75em; color:var(--mf2); }
    .pop-alert-badge {
      padding:3px 10px; border-radius:12px; font-size:0.72em; font-weight:700;
      background:var(--ac); color:#fff;
    }

    /* ── Popup: Hourly ── */
    .pop-hourly-grid { display:flex; flex-direction:column; gap:4px; }
    .pop-h-item {
      display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px;
      background:color-mix(in srgb, var(--mf1) 3%, transparent);
    }
    .pop-h-time { font-size:0.8em; font-weight:600; color:var(--mf2); width:45px; }
    .pop-h-emoji {
      font-size:20px; line-height:1;
      font-family:"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif;
    }
    .pop-h-temp { font-size:0.95em; font-weight:600; color:var(--mf1); width:35px; }
    .pop-h-precip { font-size:0.75em; color:var(--mf2); width:42px; }
    .pop-h-wind { font-size:0.72em; color:var(--mf2); margin-left:auto; }

    /* ── Popup: Daily ── */
    .pop-daily-list { display:flex; flex-direction:column; }
    .pop-d-item {
      display:flex; align-items:center; gap:8px; padding:10px 0;
      border-bottom:1px solid color-mix(in srgb, var(--mfd) 50%, transparent);
    }
    .pop-d-item:last-child { border-bottom:none; }
    .pop-d-day { font-size:0.82em; font-weight:600; color:var(--mf1); width:75px; flex-shrink:0; text-transform:capitalize; }
    .pop-d-emoji {
      font-size:20px; line-height:1; flex-shrink:0;
      font-family:"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif;
    }
    .pop-d-cond { font-size:0.75em; color:var(--mf2); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .pop-d-precip { font-size:0.72em; color:var(--mf2); width:42px; flex-shrink:0; }
    .pop-d-temps { display:flex; gap:6px; font-size:0.85em; flex-shrink:0; margin-left:auto; }
    .pop-d-hi { font-weight:600; color:var(--mf1); }
    .pop-d-lo { font-weight:400; color:var(--mf2); }
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
    description: 'Carte météo compacte avec données Météo-France — cliquez pour les détails',
    preview: true,
});

console.info(
    `%c  METEO-FRANCE-CARD  %c  v${CARD_VERSION}  `,
    'color: white; background: #0288D1; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
    'color: #0288D1; background: #E1F5FE; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);
