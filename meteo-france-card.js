/**
 * Météo France Card - Custom Lovelace Card for Home Assistant
 * Displays Météo-France weather data with "pluie dans l'heure" rain timeline
 * Uses native HA weather icons (ha-weather-icon)
 *
 * @version 1.1.0
 * @license MIT
 */

const CARD_VERSION = '1.1.0';

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

// Rain description to intensity mapping
const RAIN_DESC_MAP = {
    'Temps sec': 1,
    'Pluie faible': 2,
    'Pluie modérée': 3,
    'Pluie forte': 4,
};

// Alert colors & icons
const ALERT_COLORS = {
    'Vert': '#4CAF50',
    'Jaune': '#FFC107',
    'Orange': '#FF9800',
    'Rouge': '#F44336',
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

const WIND_DIRECTIONS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO', 'N'];

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

    // ── HACS / Lovelace Interface ──────────────────────────────────

    static getConfigElement() {
        return document.createElement('meteo-france-card-editor');
    }

    static getStubConfig() {
        return {
            entity: '',
            rain_forecast_entity: '',
            alert_entity: '',
            name: '',
            show_current: true,
            show_details: true,
            show_rain_forecast: true,
            show_alert: true,
            show_daily_forecast: true,
            show_hourly_forecast: true,
            number_of_daily_forecasts: 5,
            number_of_hourly_forecasts: 6,
        };
    }

    setConfig(config) {
        if (!config.entity) {
            throw new Error('Veuillez définir une entité weather (entity)');
        }
        this._config = {
            show_current: true,
            show_details: true,
            show_rain_forecast: true,
            show_alert: true,
            show_daily_forecast: true,
            show_hourly_forecast: true,
            number_of_daily_forecasts: 5,
            number_of_hourly_forecasts: 6,
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
            const callback = (result) => {
                if (type === 'daily') {
                    this._forecasts = result?.forecast || [];
                } else {
                    this._hourlyForecasts = result?.forecast || [];
                }
                this._render();
            };
            const sub = await this._hass.connection.subscribeMessage(callback, {
                type: 'weather/subscribe_forecast',
                forecast_type: type,
                entity_id: this._config.entity,
            });
            if (type === 'daily') {
                this._forecastSubscription = sub;
            } else {
                this._hourlyForecastSubscription = sub;
            }
        } catch (e) {
            console.warn(`MeteoFranceCard: Unable to subscribe to ${type} forecast:`, e);
        }
    }

    disconnectedCallback() {
        if (this._forecastSubscription) {
            this._forecastSubscription();
            this._forecastSubscription = null;
        }
        if (this._hourlyForecastSubscription) {
            this._hourlyForecastSubscription();
            this._hourlyForecastSubscription = null;
        }
    }

    getCardSize() {
        let size = 3;
        if (this._config.show_rain_forecast) size += 2;
        if (this._config.show_daily_forecast) size += 2;
        if (this._config.show_hourly_forecast) size += 2;
        return size;
    }

    // ── Helpers ────────────────────────────────────────────────────

    _getWeatherEntity() {
        return this._hass?.states[this._config.entity];
    }

    _getRainForecastEntity() {
        return this._config.rain_forecast_entity
            ? this._hass?.states[this._config.rain_forecast_entity]
            : null;
    }

    _getAlertEntity() {
        return this._config.alert_entity
            ? this._hass?.states[this._config.alert_entity]
            : null;
    }

    _getDetailEntity(key) {
        const entityId = this._config[key];
        return entityId ? this._hass?.states[entityId] : null;
    }

    _getWindDirection(bearing) {
        if (bearing === undefined || bearing === null) return '';
        return WIND_DIRECTIONS[Math.round(bearing / 22.5)] || '';
    }

    _formatTime(dateStr) {
        return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    _formatDay(dateStr) {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
        if (date.toDateString() === tomorrow.toDateString()) return 'Demain';
        return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    }

    // ── Rain Forecast Parsing ──────────────────────────────────────

    _parseRainForecast() {
        const entity = this._getRainForecastEntity();
        if (!entity) return null;
        const forecast = entity.attributes['1_hour_forecast'];
        const refTime = entity.attributes['forecast_time_ref'];
        if (!forecast) return null;

        const entries = [];
        for (const [time, description] of Object.entries(forecast)) {
            entries.push({
                minutes: parseInt(time),
                description,
                intensity: RAIN_DESC_MAP[description] || 1,
            });
        }
        entries.sort((a, b) => a.minutes - b.minutes);
        return { refTime, entries, hasRain: entries.some(e => e.intensity > 1) };
    }

    // ── Alert Parsing ──────────────────────────────────────────────

    _parseAlerts() {
        const entity = this._getAlertEntity();
        if (!entity) return null;
        const attrs = entity.attributes;
        const alerts = [];
        for (const [key, value] of Object.entries(attrs)) {
            if (key.startsWith('Vent') || key.startsWith('Pluie') || key.startsWith('Orage') ||
                key.startsWith('Inondation') || key.startsWith('Neige') || key.startsWith('Canicule') ||
                key.startsWith('Grand') || key.startsWith('Avalanche') || key.startsWith('Vagues')) {
                if (value && value !== 'Vert') {
                    alerts.push({ type: key, level: value });
                }
            }
        }
        return { state: entity.state, alerts };
    }

    // ── Hydrate weather icon placeholders with native HA icons ─────

    _hydrateWeatherIcons() {
        const root = this.shadowRoot;
        if (!root) return;

        root.querySelectorAll('.weather-icon-slot').forEach(slot => {
            const condition = slot.dataset.condition;
            const size = parseInt(slot.dataset.size) || 24;
            if (!condition) return;

            // Clear previous icon
            slot.innerHTML = '';

            // Create native HA weather icon element
            const icon = document.createElement('ha-weather-icon');
            icon.style.setProperty('--mdc-icon-size', `${size}px`);
            icon.style.width = `${size}px`;
            icon.style.height = `${size}px`;

            // Set the condition property (required by the Lit component)
            icon.condition = condition;

            // Pass hass for proper state-based rendering
            if (this._hass) {
                icon.hass = this._hass;
            }

            slot.appendChild(icon);
        });
    }

    // ── Render ─────────────────────────────────────────────────────

    _render() {
        if (!this._hass || !this._config.entity) return;

        const entity = this._getWeatherEntity();
        if (!entity) {
            this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="padding: 16px; color: var(--error-color);">
            Entité introuvable : ${this._config.entity}
          </div>
        </ha-card>
      `;
            return;
        }

        const attrs = entity.attributes;
        const state = entity.state;
        const name = this._config.name || attrs.friendly_name || 'Météo';
        const rainData = this._parseRainForecast();
        const alertData = this._parseAlerts();

        this.shadowRoot.innerHTML = `
      <style>${this._getStyles()}</style>
      <ha-card>
        ${this._renderHeader(name)}
        ${this._config.show_alert ? this._renderAlerts(alertData) : ''}
        ${this._config.show_current ? this._renderCurrent(state, attrs) : ''}
        ${this._config.show_details ? this._renderDetails(attrs) : ''}
        ${this._config.show_rain_forecast ? this._renderRainForecast(rainData) : ''}
        ${this._config.show_hourly_forecast ? this._renderHourlyForecast() : ''}
        ${this._config.show_daily_forecast ? this._renderDailyForecast() : ''}
      </ha-card>
    `;

        // After innerHTML is set, inject native HA weather icons into placeholders
        this._hydrateWeatherIcons();
    }

    // ── Render Sections ────────────────────────────────────────────

    _renderHeader(name) {
        return `
      <div class="card-header">
        <span class="header-title">${name}</span>
        <span class="header-subtitle">Météo-France</span>
      </div>
    `;
    }

    _renderAlerts(alertData) {
        if (!alertData || alertData.alerts.length === 0) return '';
        const alertsHtml = alertData.alerts.map(alert => {
            const color = ALERT_COLORS[alert.level] || '#FFC107';
            const icon = ALERT_TYPES[alert.type] || 'mdi:alert';
            return `
        <div class="alert-chip" style="--alert-color: ${color}">
          <ha-icon icon="${icon}"></ha-icon>
          <span>${alert.type}</span>
          <span class="alert-level">${alert.level}</span>
        </div>
      `;
        }).join('');
        return `<div class="alerts-section">${alertsHtml}</div>`;
    }

    _renderCurrent(state, attrs) {
        const label = WEATHER_LABELS_FR[state] || state;
        const temp = attrs.temperature !== undefined ? Math.round(attrs.temperature) : '--';
        const unit = attrs.temperature_unit || '°C';
        const apparentTemp = attrs.apparent_temperature !== undefined
            ? Math.round(attrs.apparent_temperature) : null;

        return `
      <div class="current-section">
        <div class="current-main">
          <div class="current-icon">
            <span class="weather-icon-slot" data-condition="${state}" data-size="52"></span>
          </div>
          <div class="current-temp">
            <span class="temp-value">${temp}</span>
            <span class="temp-unit">${unit}</span>
          </div>
        </div>
        <div class="current-info">
          <div class="condition-label">${label}</div>
          ${apparentTemp !== null ? `<div class="apparent-temp">Ressenti ${apparentTemp}${unit}</div>` : ''}
        </div>
      </div>
    `;
    }

    _renderDetails(attrs) {
        const details = [];

        if (attrs.humidity !== undefined)
            details.push({ icon: 'mdi:water-percent', label: 'Humidité', value: `${attrs.humidity}%` });
        if (attrs.pressure !== undefined)
            details.push({ icon: 'mdi:gauge', label: 'Pression', value: `${attrs.pressure} ${attrs.pressure_unit || 'hPa'}` });
        if (attrs.wind_speed !== undefined) {
            const dir = this._getWindDirection(attrs.wind_bearing);
            details.push({ icon: 'mdi:weather-windy', label: 'Vent', value: `${Math.round(attrs.wind_speed)} ${attrs.wind_speed_unit || 'km/h'} ${dir}` });
        }
        if (attrs.wind_gust_speed !== undefined)
            details.push({ icon: 'mdi:weather-windy-variant', label: 'Rafales', value: `${Math.round(attrs.wind_gust_speed)} ${attrs.wind_speed_unit || 'km/h'}` });
        if (attrs.visibility !== undefined)
            details.push({ icon: 'mdi:eye', label: 'Visibilité', value: `${attrs.visibility} ${attrs.visibility_unit || 'km'}` });
        if (attrs.uv_index !== undefined)
            details.push({ icon: 'mdi:sun-wireless', label: 'UV', value: attrs.uv_index });
        if (attrs.cloud_coverage !== undefined)
            details.push({ icon: 'mdi:cloud', label: 'Nébulosité', value: `${attrs.cloud_coverage}%` });
        if (attrs.dew_point !== undefined)
            details.push({ icon: 'mdi:thermometer-water', label: 'Point de rosée', value: `${Math.round(attrs.dew_point)}°` });

        // Météo-France specific entities
        for (const { key, icon, label } of [
            { key: 'rain_chance_entity', icon: 'mdi:umbrella', label: 'Risque pluie' },
            { key: 'freeze_chance_entity', icon: 'mdi:snowflake', label: 'Risque gel' },
            { key: 'snow_chance_entity', icon: 'mdi:snowflake-variant', label: 'Risque neige' },
        ]) {
            const ent = this._getDetailEntity(key);
            if (ent) details.push({ icon, label, value: `${ent.state}%` });
        }
        const uvEntity = this._getDetailEntity('uv_entity');
        if (uvEntity && attrs.uv_index === undefined)
            details.push({ icon: 'mdi:sun-wireless', label: 'UV', value: uvEntity.state });

        if (details.length === 0) return '';

        const html = details.map(d => `
      <div class="detail-item">
        <ha-icon icon="${d.icon}"></ha-icon>
        <div class="detail-content">
          <span class="detail-label">${d.label}</span>
          <span class="detail-value">${d.value}</span>
        </div>
      </div>
    `).join('');

        return `<div class="details-section"><div class="details-grid">${html}</div></div>`;
    }

    _renderRainForecast(rainData) {
        if (!rainData) {
            if (this._config.rain_forecast_entity) {
                return `
          <div class="rain-section">
            <div class="section-title">
              <ha-icon icon="mdi:weather-rainy"></ha-icon>
              <span>Pluie dans l'heure</span>
            </div>
            <div class="rain-unavailable">Données indisponibles</div>
          </div>
        `;
            }
            return '';
        }

        const refTime = rainData.refTime ? this._formatTime(rainData.refTime) : '';

        const barsHtml = rainData.entries.map(entry => {
            let barColor, barHeight;
            switch (entry.intensity) {
                case 1: barColor = 'var(--rain-dry-color, #555)'; barHeight = '8%'; break;
                case 2: barColor = 'var(--rain-light-color, #64B5F6)'; barHeight = '40%'; break;
                case 3: barColor = 'var(--rain-moderate-color, #1E88E5)'; barHeight = '70%'; break;
                case 4: barColor = 'var(--rain-heavy-color, #0D47A1)'; barHeight = '100%'; break;
                default: barColor = 'var(--rain-dry-color, #555)'; barHeight = '8%';
            }
            return `
        <div class="rain-bar-container" title="${entry.description} (${entry.minutes} min)">
          <div class="rain-bar" style="height: ${barHeight}; background: ${barColor};"></div>
        </div>
      `;
        }).join('');

        const statusText = rainData.hasRain
            ? '🌧️ Pluie prévue dans l\'heure'
            : '☀️ Pas de pluie dans l\'heure';

        return `
      <div class="rain-section">
        <div class="section-title">
          <ha-icon icon="mdi:weather-rainy"></ha-icon>
          <span>Pluie dans l'heure</span>
          ${refTime ? `<span class="section-time">${refTime}</span>` : ''}
        </div>
        <div class="rain-status ${rainData.hasRain ? 'has-rain' : 'no-rain'}">${statusText}</div>
        <div class="rain-timeline">
          <div class="rain-bars">${barsHtml}</div>
          <div class="rain-time-labels">
            <span>Maint.</span><span>+15 min</span><span>+30 min</span><span>+45 min</span><span>+60 min</span>
          </div>
        </div>
        <div class="rain-legend">
          <span class="legend-item"><span class="legend-dot" style="background: var(--rain-dry-color, #555)"></span>Sec</span>
          <span class="legend-item"><span class="legend-dot" style="background: var(--rain-light-color, #64B5F6)"></span>Faible</span>
          <span class="legend-item"><span class="legend-dot" style="background: var(--rain-moderate-color, #1E88E5)"></span>Modérée</span>
          <span class="legend-item"><span class="legend-dot" style="background: var(--rain-heavy-color, #0D47A1)"></span>Forte</span>
        </div>
      </div>
    `;
    }

    _renderHourlyForecast() {
        if (!this._hourlyForecasts || this._hourlyForecasts.length === 0) return '';

        const count = this._config.number_of_hourly_forecasts || 6;
        const forecasts = this._hourlyForecasts.slice(0, count);

        const itemsHtml = forecasts.map(fc => {
            const temp = fc.temperature !== undefined ? Math.round(fc.temperature) : '--';
            const time = this._formatTime(fc.datetime);
            const precip = fc.precipitation_probability !== undefined
                ? `${fc.precipitation_probability}%` : '';

            return `
        <div class="hourly-item">
          <span class="hourly-time">${time}</span>
          <span class="weather-icon-slot hourly-weather-icon" data-condition="${fc.condition || 'cloudy'}" data-size="28"></span>
          <span class="hourly-temp">${temp}°</span>
          ${precip ? `<span class="hourly-precip"><ha-icon icon="mdi:umbrella" style="--mdc-icon-size: 12px;"></ha-icon>${precip}</span>` : ''}
        </div>
      `;
        }).join('');

        return `
      <div class="hourly-section">
        <div class="section-title">
          <ha-icon icon="mdi:clock-outline"></ha-icon>
          <span>Prévisions horaires</span>
        </div>
        <div class="hourly-scroll">${itemsHtml}</div>
      </div>
    `;
    }

    _renderDailyForecast() {
        if (!this._forecasts || this._forecasts.length === 0) return '';

        const count = this._config.number_of_daily_forecasts || 5;
        const forecasts = this._forecasts.slice(0, count);

        const itemsHtml = forecasts.map(fc => {
            const tempHigh = fc.temperature !== undefined ? Math.round(fc.temperature) : '--';
            const tempLow = fc.templow !== undefined ? Math.round(fc.templow) : '--';
            const day = this._formatDay(fc.datetime);
            const precip = fc.precipitation_probability !== undefined
                ? `${fc.precipitation_probability}%` : '';

            return `
        <div class="daily-item">
          <span class="daily-day">${day}</span>
          <span class="weather-icon-slot daily-weather-icon" data-condition="${fc.condition || 'cloudy'}" data-size="24"></span>
          ${precip ? `<span class="daily-precip"><ha-icon icon="mdi:umbrella" style="--mdc-icon-size: 13px;"></ha-icon>${precip}</span>` : '<span class="daily-precip"></span>'}
          <span class="daily-temps">
            <span class="daily-high">${tempHigh}°</span>
            <span class="daily-low">${tempLow}°</span>
          </span>
        </div>
      `;
        }).join('');

        return `
      <div class="daily-section">
        <div class="section-title">
          <ha-icon icon="mdi:calendar-week"></ha-icon>
          <span>Prévisions</span>
        </div>
        ${itemsHtml}
      </div>
    `;
    }

    // ── Styles ─────────────────────────────────────────────────────

    _getStyles() {
        return `
      :host {
        --mf-primary: var(--primary-text-color, #212121);
        --mf-secondary: var(--secondary-text-color, #727272);
        --mf-accent: var(--accent-color, #03A9F4);
        --mf-divider: var(--divider-color, rgba(0, 0, 0, 0.12));
        --mf-card-bg: var(--card-background-color, #fff);
        --mf-radius: 12px;
      }

      ha-card {
        overflow: hidden;
        border-radius: var(--ha-card-border-radius, var(--mf-radius));
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 16px 8px;
      }
      .header-title { font-size: 1.1em; font-weight: 600; color: var(--mf-primary); }
      .header-subtitle {
        font-size: 0.75em; font-weight: 500; color: var(--mf-accent);
        text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;
      }

      /* ── Alerts ──────────────────────────────── */
      .alerts-section { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 8px; }
      .alert-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 10px; border-radius: 16px;
        font-size: 0.75em; font-weight: 500;
        background: color-mix(in srgb, var(--alert-color) 15%, transparent);
        color: var(--alert-color);
        border: 1px solid color-mix(in srgb, var(--alert-color) 30%, transparent);
      }
      .alert-chip ha-icon { --mdc-icon-size: 14px; }
      .alert-level { font-weight: 700; }

      /* ── Current Weather ─────────────────────── */
      .current-section {
        padding: 8px 16px 16px;
        display: flex; align-items: center; gap: 16px;
      }
      .current-main { display: flex; align-items: center; gap: 12px; }
      .current-icon {
        display: flex; align-items: center; justify-content: center;
        width: 56px; height: 56px;
      }
      .current-temp { display: flex; align-items: flex-start; }
      .temp-value { font-size: 3em; font-weight: 300; line-height: 1; color: var(--mf-primary); }
      .temp-unit { font-size: 1.2em; font-weight: 400; color: var(--mf-secondary); margin-top: 6px; margin-left: 2px; }
      .current-info { flex: 1; text-align: right; }
      .condition-label { font-size: 1em; font-weight: 500; color: var(--mf-primary); }
      .apparent-temp { font-size: 0.85em; color: var(--mf-secondary); margin-top: 2px; }

      /* ── Details Grid ────────────────────────── */
      .details-section { padding: 0 16px 12px; }
      .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .detail-item {
        display: flex; align-items: center; gap: 8px;
        padding: 6px 8px; border-radius: 8px;
        background: color-mix(in srgb, var(--mf-primary) 4%, transparent);
      }
      .detail-item ha-icon { --mdc-icon-size: 18px; color: var(--mf-secondary); flex-shrink: 0; }
      .detail-content { display: flex; flex-direction: column; min-width: 0; }
      .detail-label { font-size: 0.7em; color: var(--mf-secondary); text-transform: uppercase; letter-spacing: 0.3px; }
      .detail-value {
        font-size: 0.85em; font-weight: 500; color: var(--mf-primary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }

      /* ── Section Titles ──────────────────────── */
      .section-title {
        display: flex; align-items: center; gap: 6px;
        padding-bottom: 8px; font-size: 0.85em; font-weight: 600; color: var(--mf-secondary);
      }
      .section-title ha-icon { --mdc-icon-size: 18px; }
      .section-time { margin-left: auto; font-weight: 400; font-size: 0.9em; opacity: 0.7; }

      /* ── Rain Forecast ───────────────────────── */
      .rain-section {
        padding: 12px 16px; margin: 0 12px 12px; border-radius: 12px;
        background: color-mix(in srgb, var(--mf-accent) 6%, transparent);
        border: 1px solid color-mix(in srgb, var(--mf-accent) 12%, transparent);
      }
      .rain-status { font-size: 0.85em; font-weight: 500; margin-bottom: 10px; }
      .rain-status.no-rain { color: var(--success-color, #4CAF50); }
      .rain-status.has-rain { color: var(--warning-color, #FF9800); }
      .rain-timeline { margin-bottom: 8px; }
      .rain-bars { display: flex; gap: 2px; height: 60px; align-items: flex-end; padding: 0 4px; }
      .rain-bar-container { flex: 1; height: 100%; display: flex; align-items: flex-end; cursor: pointer; }
      .rain-bar {
        width: 100%; border-radius: 3px 3px 0 0;
        transition: height 0.3s ease, background 0.3s ease; min-height: 4px;
      }
      .rain-bar-container:hover .rain-bar { opacity: 0.8; filter: brightness(1.1); }
      .rain-time-labels {
        display: flex; justify-content: space-between;
        padding: 6px 0 0; font-size: 0.65em; color: var(--mf-secondary);
        border-top: 1px solid var(--mf-divider); margin-top: 4px;
      }
      .rain-unavailable { font-size: 0.85em; color: var(--mf-secondary); font-style: italic; padding: 8px 0; }
      .rain-legend { display: flex; justify-content: center; gap: 12px; font-size: 0.7em; color: var(--mf-secondary); }
      .legend-item { display: flex; align-items: center; gap: 4px; }
      .legend-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }

      /* ── Hourly Forecast ─────────────────────── */
      .hourly-section { padding: 12px 16px; border-top: 1px solid var(--mf-divider); }
      .hourly-scroll {
        display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px;
        scrollbar-width: thin;
      }
      .hourly-scroll::-webkit-scrollbar { height: 4px; }
      .hourly-scroll::-webkit-scrollbar-thumb { background: var(--mf-divider); border-radius: 2px; }
      .hourly-item {
        display: flex; flex-direction: column; align-items: center; gap: 4px;
        min-width: 56px; padding: 8px 6px; border-radius: 10px;
        background: color-mix(in srgb, var(--mf-primary) 3%, transparent); flex-shrink: 0;
      }
      .hourly-time { font-size: 0.72em; font-weight: 500; color: var(--mf-secondary); }
      .hourly-weather-icon { display: flex; align-items: center; justify-content: center; height: 28px; }
      .hourly-temp { font-size: 0.9em; font-weight: 600; color: var(--mf-primary); }
      .hourly-precip { display: flex; align-items: center; gap: 2px; font-size: 0.65em; color: var(--mf-secondary); }
      .hourly-precip ha-icon { --mdc-icon-size: 12px; color: var(--mf-secondary); }

      /* ── Daily Forecast ──────────────────────── */
      .daily-section { padding: 12px 16px 16px; border-top: 1px solid var(--mf-divider); }
      .daily-item { display: flex; align-items: center; gap: 8px; padding: 7px 0; }
      .daily-item:not(:last-child) { border-bottom: 1px solid color-mix(in srgb, var(--mf-divider) 50%, transparent); }
      .daily-day {
        font-size: 0.85em; font-weight: 500; color: var(--mf-primary);
        width: 80px; flex-shrink: 0; text-transform: capitalize;
      }
      .daily-weather-icon {
        display: flex; align-items: center; justify-content: center;
        width: 28px; height: 28px; flex-shrink: 0;
      }
      .daily-precip {
        display: flex; align-items: center; gap: 2px;
        font-size: 0.75em; color: var(--mf-secondary); width: 48px; flex-shrink: 0;
      }
      .daily-precip ha-icon { --mdc-icon-size: 13px; color: var(--mf-secondary); }
      .daily-temps { margin-left: auto; display: flex; gap: 6px; font-size: 0.9em; flex-shrink: 0; }
      .daily-high { font-weight: 600; color: var(--mf-primary); width: 32px; text-align: right; }
      .daily-low { font-weight: 400; color: var(--mf-secondary); width: 32px; text-align: right; }

      /* ── Weather icon placeholders ────────────── */
      .weather-icon-slot { display: inline-flex; align-items: center; justify-content: center; }
    `;
    }
}

// ── Card Editor ──────────────────────────────────────────────────

class MeteoFranceCardEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._config = {};
        this._hass = null;
    }

    set hass(hass) { this._hass = hass; }

    setConfig(config) {
        this._config = config;
        this._render();
    }

    _render() {
        this.shadowRoot.innerHTML = `
      <style>
        .editor-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .editor-row label { font-weight: 500; font-size: 0.9em; color: var(--primary-text-color); }
        .editor-row input, .editor-row select {
          padding: 8px; border: 1px solid var(--divider-color);
          border-radius: 8px; background: var(--card-background-color);
          color: var(--primary-text-color); font-size: 0.9em;
        }
        .editor-row .checkbox-row { display: flex; align-items: center; gap: 8px; }
        h3 {
          margin: 16px 0 8px; font-size: 0.95em; color: var(--primary-text-color);
          border-bottom: 1px solid var(--divider-color); padding-bottom: 4px;
        }
      </style>

      <h3>Entités principales</h3>
      <div class="editor-row">
        <label>Entité météo (weather.*)</label>
        <input type="text" id="entity" value="${this._config.entity || ''}" placeholder="weather.saint_cyr_l_ecole">
      </div>
      <div class="editor-row">
        <label>Entité pluie prochaine heure</label>
        <input type="text" id="rain_forecast_entity" value="${this._config.rain_forecast_entity || ''}" placeholder="sensor.saint_cyr_l_ecole_next_rain">
      </div>
      <div class="editor-row">
        <label>Entité alertes météo</label>
        <input type="text" id="alert_entity" value="${this._config.alert_entity || ''}" placeholder="sensor.78_weather_alert">
      </div>

      <h3>Entités détail (optionnel)</h3>
      <div class="editor-row">
        <label>Risque de pluie</label>
        <input type="text" id="rain_chance_entity" value="${this._config.rain_chance_entity || ''}">
      </div>
      <div class="editor-row">
        <label>Risque de gel</label>
        <input type="text" id="freeze_chance_entity" value="${this._config.freeze_chance_entity || ''}">
      </div>
      <div class="editor-row">
        <label>Risque de neige</label>
        <input type="text" id="snow_chance_entity" value="${this._config.snow_chance_entity || ''}">
      </div>
      <div class="editor-row">
        <label>Indice UV</label>
        <input type="text" id="uv_entity" value="${this._config.uv_entity || ''}">
      </div>

      <h3>Affichage</h3>
      <div class="editor-row">
        <label>Nom personnalisé</label>
        <input type="text" id="name" value="${this._config.name || ''}">
      </div>
      <div class="editor-row"><div class="checkbox-row"><input type="checkbox" id="show_current" ${this._config.show_current !== false ? 'checked' : ''}><label for="show_current">Météo actuelle</label></div></div>
      <div class="editor-row"><div class="checkbox-row"><input type="checkbox" id="show_details" ${this._config.show_details !== false ? 'checked' : ''}><label for="show_details">Détails</label></div></div>
      <div class="editor-row"><div class="checkbox-row"><input type="checkbox" id="show_rain_forecast" ${this._config.show_rain_forecast !== false ? 'checked' : ''}><label for="show_rain_forecast">Pluie dans l'heure</label></div></div>
      <div class="editor-row"><div class="checkbox-row"><input type="checkbox" id="show_alert" ${this._config.show_alert !== false ? 'checked' : ''}><label for="show_alert">Alertes</label></div></div>
      <div class="editor-row"><div class="checkbox-row"><input type="checkbox" id="show_hourly_forecast" ${this._config.show_hourly_forecast !== false ? 'checked' : ''}><label for="show_hourly_forecast">Prévisions horaires</label></div></div>
      <div class="editor-row"><div class="checkbox-row"><input type="checkbox" id="show_daily_forecast" ${this._config.show_daily_forecast !== false ? 'checked' : ''}><label for="show_daily_forecast">Prévisions journalières</label></div></div>
      <div class="editor-row">
        <label>Prévisions horaires (nombre)</label>
        <input type="number" id="number_of_hourly_forecasts" min="1" max="24" value="${this._config.number_of_hourly_forecasts || 6}">
      </div>
      <div class="editor-row">
        <label>Prévisions jours (nombre)</label>
        <input type="number" id="number_of_daily_forecasts" min="1" max="7" value="${this._config.number_of_daily_forecasts || 5}">
      </div>
    `;

        ['entity', 'rain_forecast_entity', 'alert_entity', 'name',
            'rain_chance_entity', 'freeze_chance_entity', 'snow_chance_entity', 'uv_entity'
        ].forEach(id => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.addEventListener('change', () => {
                this._config = { ...this._config, [id]: el.value };
                this._fireConfigChanged();
            });
        });

        ['show_current', 'show_details', 'show_rain_forecast',
            'show_alert', 'show_hourly_forecast', 'show_daily_forecast'
        ].forEach(id => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.addEventListener('change', () => {
                this._config = { ...this._config, [id]: el.checked };
                this._fireConfigChanged();
            });
        });

        ['number_of_hourly_forecasts', 'number_of_daily_forecasts'].forEach(id => {
            const el = this.shadowRoot.getElementById(id);
            if (el) el.addEventListener('change', () => {
                this._config = { ...this._config, [id]: parseInt(el.value) };
                this._fireConfigChanged();
            });
        });
    }

    _fireConfigChanged() {
        this.dispatchEvent(new CustomEvent('config-changed', {
            detail: { config: this._config },
            bubbles: true, composed: true,
        }));
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
    documentationURL: 'https://github.com/your-repo/meteo-france-card',
});

console.info(
    `%c  METEO-FRANCE-CARD  %c  v${CARD_VERSION}  `,
    'color: white; background: #0288D1; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
    'color: #0288D1; background: #E1F5FE; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);
