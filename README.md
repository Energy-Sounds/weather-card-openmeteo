# Wetterkarte Open-Meteo

Custom Lovelace Card für Home Assistant mit Live-Wetterdaten von [Open-Meteo](https://open-meteo.com/) – **kostenlos, kein API-Key erforderlich**.

![Vorschau](preview.png)

## Features

- Aktuelles Wetter: Temperatur, gefühlte Temperatur, Luftfeuchtigkeit, Wind, Niederschlag
- 5-Tage-Vorhersage mit Tageshöchst- und Tiefstwerten
- Ortssuche per Eingabefeld (Open-Meteo Geocoding API)
- WMO-Wettercode-Mapping mit Emoji-Icons
- Deutsche Beschriftungen und Wochentage
- Zeitzone Europe/Vienna
- Automatische Aktualisierung beim Laden
- Kein HACS-Plugin, kein API-Key, keine Abhängigkeiten

## Installation via HACS

1. HACS öffnen → **Frontend** → ⋮ → **Benutzerdefinierte Repositories**
2. URL eingeben: `https://github.com/DEIN-GITHUB-NAME/weather-card-openmeteo`
3. Kategorie: **Lovelace** → **Hinzufügen**
4. Karte suchen → **Installieren** → Home Assistant neu laden

## Manuelle Installation

1. `weather-card-openmeteo.js` nach `/config/www/` kopieren
2. Ressource eintragen:
   - **Einstellungen → Dashboards → ⋮ → Ressourcen → + Hinzufügen**
   - URL: `/local/weather-card-openmeteo.js`
   - Typ: **JavaScript-Modul**

## Karte hinzufügen

Im Dashboard: **Karte hinzufügen → Manuell (YAML)**:

```yaml
type: custom:weather-card-openmeteo
location_name: Deutschlandsberg, Österreich
lat: 46.8189
lon: 15.0686
```

### Konfigurationsoptionen

| Option | Typ | Standard | Beschreibung |
|---|---|---|---|
| `location_name` | string | `Deutschlandsberg` | Angezeigter Ortsname |
| `lat` | number | `46.8189` | Breitengrad |
| `lon` | number | `15.0686` | Längengrad |

> **Tipp:** Der Ort kann auch zur Laufzeit über das Eingabefeld (✏️-Button) geändert werden – die Suche nutzt die Open-Meteo Geocoding API.

## Beispiele

```yaml
# Wien
type: custom:weather-card-openmeteo
location_name: Wien
lat: 48.2082
lon: 16.3738

# Graz
type: custom:weather-card-openmeteo
location_name: Graz
lat: 47.0707
lon: 15.4395

# Berlin
type: custom:weather-card-openmeteo
location_name: Berlin
lat: 52.5200
lon: 13.4050
```

## Wettercode-Mapping (WMO)

Die Karte unterstützt alle WMO-Wettercodes (0–99) mit passenden Emojis und deutschen Beschreibungen.

## Lizenz

MIT
