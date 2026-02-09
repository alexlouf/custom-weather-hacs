# 🌦️ Carte Météo France pour Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)

Carte Lovelace personnalisée pour Home Assistant affichant les données de l'intégration [Météo-France](https://www.home-assistant.io/integrations/meteo_france/), incluant la **pluie dans l'heure** avec une timeline visuelle.


## ✨ Fonctionnalités

- **Météo actuelle** — Température, ressenti, condition, icône
- **Pluie dans l'heure** — Timeline visuelle par tranche de 5 min avec légende d'intensité
- **Alertes météo** — Chips colorés (Jaune/Orange/Rouge) par type de vigilance
- **Détails** — Humidité, pression, vent, rafales, visibilité, UV, nébulosité, point de rosée
- **Entités Météo-France** — Risque pluie/gel/neige depuis les capteurs dédiés
- **Prévisions horaires** — Défilement horizontal avec icônes, températures, probabilité de pluie
- **Prévisions journalières** — 5 jours avec min/max et probabilité de pluie
- **Éditeur visuel** — Configuration complète via l'UI de Lovelace
- **Thème adaptatif** — S'adapte automatiquement au thème clair/sombre de HA

## 📋 Prérequis

L'intégration **Météo-France** doit être configurée dans Home Assistant :

1. **Settings** → **Devices & services** → **Add Integration** → **Météo-France**
2. Renseigner votre ville
3. Activer les entités désactivées par défaut si nécessaire (Settings → Devices & services → Météo-France → Entités)

Entités utilisées :
| Entité | Description | Obligatoire |
|--------|-------------|:-----------:|
| `weather.ma_ville` | Entité météo principale | ✅ |
| `sensor.ma_ville_next_rain` | Pluie dans l'heure | Recommandé |
| `sensor.XX_weather_alert` | Alertes départementales | Optionnel |
| `sensor.ma_ville_rain_chance` | Probabilité de pluie | Optionnel |
| `sensor.ma_ville_freeze_chance` | Probabilité de gel | Optionnel |
| `sensor.ma_ville_snow_chance` | Probabilité de neige | Optionnel |
| `sensor.ma_ville_uv` | Indice UV | Optionnel |

## 🚀 Installation

### Via HACS (recommandé)

1. Ouvrir **HACS** → **Frontend**
2. Menu ⋮ → **Dépôts personnalisés**
3. Ajouter l'URL du dépôt avec la catégorie **Dashboard (Lovelace)**
4. Chercher **Carte Météo France** et l'installer
5. Redémarrer Home Assistant

### Installation manuelle

1. Télécharger `meteo-france-card.js` depuis le dossier `dist/`
2. Copier dans `config/www/community/meteo-france-card/`
3. Ajouter la ressource dans **Settings** → **Dashboards** → **Resources** :
   ```
   /local/community/meteo-france-card/meteo-france-card.js
   ```
   Type : **JavaScript Module**

## ⚙️ Configuration

### Via l'éditeur visuel

1. Modifier un dashboard → **Ajouter une carte**
2. Chercher **Carte Météo France** en bas de la liste
3. Configurer via l'éditeur graphique

### Via YAML

```yaml
type: custom:meteo-france-card
entity: weather.guyancourt
rain_forecast_entity: sensor.guyancourt_next_rain
alert_entity: sensor.78_weather_alert
name: Guyancourt

# Entités détail optionnelles
rain_chance_entity: sensor.guyancourt_rain_chance
freeze_chance_entity: sensor.guyancourt_freeze_chance
snow_chance_entity: sensor.guyancourt_snow_chance
uv_entity: sensor.guyancourt_uv

# Affichage (tous true par défaut)
show_current: true
show_details: true
show_rain_forecast: true
show_alert: true
show_hourly_forecast: true
show_daily_forecast: true

# Nombre de prévisions
number_of_hourly_forecasts: 6
number_of_daily_forecasts: 5
```

### Options

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `entity` | string | **requis** | Entité `weather.*` Météo-France |
| `rain_forecast_entity` | string | | Entité `sensor.*_next_rain` |
| `alert_entity` | string | | Entité `sensor.*_weather_alert` |
| `name` | string | Nom de l'entité | Nom affiché en en-tête |
| `rain_chance_entity` | string | | Probabilité de pluie |
| `freeze_chance_entity` | string | | Probabilité de gel |
| `snow_chance_entity` | string | | Probabilité de neige |
| `uv_entity` | string | | Indice UV |
| `show_current` | boolean | `true` | Afficher la météo actuelle |
| `show_details` | boolean | `true` | Afficher les détails |
| `show_rain_forecast` | boolean | `true` | Afficher pluie dans l'heure |
| `show_alert` | boolean | `true` | Afficher les alertes |
| `show_hourly_forecast` | boolean | `true` | Prévisions horaires |
| `show_daily_forecast` | boolean | `true` | Prévisions journalières |
| `number_of_hourly_forecasts` | number | `6` | Heures affichées (1-24) |
| `number_of_daily_forecasts` | number | `5` | Jours affichés (1-7) |

### Personnalisation des couleurs (CSS)

```yaml
# Dans votre thème ou via card-mod :
--rain-dry-color: #E0E0E0
--rain-light-color: #64B5F6
--rain-moderate-color: #1E88E5
--rain-heavy-color: #0D47A1
```

## 🌧️ Pluie dans l'heure

La section "Pluie dans l'heure" affiche une timeline avec :
- **Barres verticales** : intensité de pluie par tranche de 5-10 min
- **Légende** : Sec / Faible / Modérée / Forte
- **Status** : indicateur texte pluie prévue ou non
- **Heure de référence** : horodatage de la prévision

> **Note** : La disponibilité de cette donnée dépend de votre localisation. Vérifiez sur [meteofrance.com](https://meteofrance.com) que "Pluie dans l'heure" est disponible pour votre ville.

## 🚨 Alertes

Les alertes sont affichées sous forme de chips colorés selon le niveau de vigilance Météo-France :
- 🟡 **Jaune** — Soyez attentif
- 🟠 **Orange** — Soyez très vigilant
- 🔴 **Rouge** — Vigilance absolue

Types : Vent violent, Pluie-inondation, Orages, Inondation, Neige-verglas, Canicule, Grand Froid, Avalanches, Vagues-submersion.

## 📝 Changelog

### v1.0.0
- Version initiale
- Météo actuelle avec icônes MDI
- Timeline pluie dans l'heure
- Alertes météo départementales
- Prévisions horaires et journalières
- Éditeur visuel complet
- Support thème clair/sombre

## 📄 Licence

MIT
