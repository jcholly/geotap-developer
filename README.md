# GeoTap Developer

**One API for 28+ US federal environmental and infrastructure data sources.**

GeoTap aggregates data from FEMA, USGS, EPA, NOAA, USDA, USFWS, DOT, Census, and more into a single REST API. This repository contains:

- **REST API documentation** — query federal data programmatically
- **MCP Server** — connect GeoTap to Claude, Cursor, Windsurf, and other AI tools

> **Web App**: [geotapdata.com](https://geotapdata.com) — no code required, draw on a map and explore data visually.

---

## Data Sources

| Agency | Data Available |
|--------|---------------|
| **FEMA** | Flood zones, FIRM panels, flood insurance rate maps, floodway boundaries |
| **USGS** | Elevation (3DEP at 1m/10m/30m), geology, streamgages, groundwater, land use (NLCD), StreamStats, National Streamflow Statistics (NSS) |
| **EPA** | Water quality (ATTAINS), Superfund sites, brownfields, TRI toxic releases, USTs, NPDES outfalls |
| **NOAA** | Rainfall (Atlas 14), IDF curves, tide stations, climate projections (CMIP6), weather stations, radar |
| **USDA/NRCS** | Soils (SSURGO), curve numbers, hydrologic soil groups, TR-55 parameters |
| **USFWS** | Wetlands (NWI), endangered species, critical habitat |
| **DOT** | Bridges, tunnels, National Bridge Inventory |
| **Census** | Demographics, boundaries, TIGER geographic data |
| **USACE** | Dams, levees, navigation channels |
| **NHD** | Stream flowlines, hydrography, watershed boundaries (HUC-8/10/12) |
| **Other** | Power plants, mines, tribal lands, building footprints, and more |

Every API response includes **source attribution** — the federal agency, dataset name, and reference URL — so you always know where the data came from.

---

## Quick Start

### Option 1: REST API

```bash
# Get flood zones, wetlands, soils, and 16 more layers for a location
curl "https://geotapdata.com/api/v1/spatial/near?lat=30.267&lng=-97.743&radius=0.5"

# Get NOAA Atlas 14 rainfall data
curl "https://geotapdata.com/api/v1/rainfall/atlas14?lat=30.267&lon=-97.743"

# Geocode an address
curl "https://geotapdata.com/api/v1/geocode?address=123+Main+St+Austin+TX"
```

### Option 2: MCP Server (for AI tools)

Add to Claude Desktop or Cursor config:
```json
{
  "mcpServers": {
    "geotap": {
      "command": "npx",
      "args": ["-y", "geotap-mcp-server"]
    }
  }
}
```

Then ask: *"What are the flood zones at 123 Main St, Austin TX?"*

---

## REST API Reference

**Base URL**: `https://geotapdata.com/api/v1`

### Authentication

API keys are **optional** during the open beta. All endpoints work without authentication.

| Method | Details |
|--------|---------|
| **Header** | `X-API-Key: your-key-here` |
| **Query param** | `?api_key=your-key-here` |
| **Register** | `POST https://geotapdata.com/api/keys/register` with `{"email": "you@example.com"}` |

Authenticated requests get higher rate limits and usage tracking.

### Rate Limits

| Tier | Monthly Requests | Burst (per min) | Cost |
|------|-----------------|------------------|------|
| **Unauthenticated** | No limit | 100/min (IP-based) | Free |
| **Free** (with key) | 50 | 5/min | Free |
| **Starter** | 1,000 | 20/min | Coming soon |
| **Pro** | 10,000 | 60/min | Coming soon |
| **Enterprise** | 100,000 | 200/min | Coming soon |

Rate limit headers are included in every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### Response Format

Every response includes:

```json
{
  "success": true,
  "data": { ... },
  "_meta": {
    "sources": [
      {
        "agency": "FEMA",
        "dataset": "National Flood Hazard Layer (NFHL)",
        "url": "https://www.fema.gov/flood-maps/national-flood-hazard-layer"
      }
    ],
    "retrievedAt": "2026-03-19T12:00:00.000Z",
    "disclaimer": "Data sourced from US federal agencies via GeoTap..."
  }
}
```

---

### Endpoints

#### Geocoding

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/geocode?address={address}` | Convert a US address to coordinates |

```bash
curl "https://geotapdata.com/api/v1/geocode?address=456+Oak+Ave+Houston+TX"
```

#### Spatial Queries

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/spatial/near?lat={lat}&lng={lng}&radius={km}` | Query all layers near a point |
| POST | `/spatial/in-polygon` | Query all layers within a polygon |
| POST | `/spatial/summary` | Feature counts per layer (fast) |
| GET | `/spatial/bbox?bbox={w,s,e,n}` | Query layers in a bounding box |

```bash
# All environmental data within 0.5 km of a point
curl "https://geotapdata.com/api/v1/spatial/near?lat=34.05&lng=-118.25&radius=0.5"

# Specific layers only
curl "https://geotapdata.com/api/v1/spatial/near?lat=34.05&lng=-118.25&radius=0.5&layers=flood_zones,wetlands,soil_map_units"

# Query within a polygon
curl -X POST "https://geotapdata.com/api/v1/spatial/in-polygon" \
  -H "Content-Type: application/json" \
  -d '{
    "polygon": {
      "type": "Polygon",
      "coordinates": [[[-97.75,30.26],[-97.74,30.26],[-97.74,30.27],[-97.75,30.27],[-97.75,30.26]]]
    }
  }'
```

#### Data Layers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/layers` | List all available data layers |
| GET | `/layers/{name}` | Get metadata for a layer |
| GET | `/layers/{name}/features?bbox={w,s,e,n}` | Get features from a layer |

**Available layer names**: `flood_zones`, `wetlands`, `soil_map_units`, `dem_elevation`, `nlcd_land_cover`, `contours`, `building_footprints`, `stream_gauges`, `streams_rivers`, `weather_alerts`, `critical_habitat`, `protected_lands`, `brownfields`, `superfund`, `ust`, `npdes_outfalls`, `dams`, `levees`, `impaired_waters`, `satellite_imagery`, `sole_source_aquifers`

#### Rainfall & Precipitation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rainfall/atlas14?lat={lat}&lon={lon}` | NOAA Atlas 14 precipitation frequency |
| GET | `/rainfall/atlas14/idf?lat={lat}&lon={lon}` | IDF curve data |
| POST | `/rainfall/hyetograph` | Generate design storm hyetograph |
| POST | `/rainfall/export` | Export hyetograph as CSV/JSON |
| GET | `/rainfall/distributions` | List rainfall distribution types |
| GET | `/rainfall/recommend?lat={lat}&lon={lon}` | Recommended SCS distribution |
| GET | `/rainfall/climate/scenarios` | Available climate scenarios |
| GET | `/rainfall/climate/factors?lat={lat}&lon={lon}&horizon={h}&scenario={s}` | Climate change multipliers |
| POST | `/rainfall/climate/project` | Future rainfall projections |
| GET | `/rainfall/uncertainty/bounds?lat={lat}&lon={lon}&returnPeriod={rp}&duration={d}` | Confidence intervals |
| POST | `/rainfall/uncertainty/envelope` | Monte Carlo uncertainty bands |
| POST | `/rainfall/uncertainty/sensitivity` | Parameter sensitivity analysis |

```bash
# Atlas 14 rainfall for all durations and return periods
curl "https://geotapdata.com/api/v1/rainfall/atlas14?lat=32.78&lon=-96.80"

# Generate a 25-year, 24-hour design storm hyetograph
curl -X POST "https://geotapdata.com/api/v1/rainfall/hyetograph" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 32.78,
    "longitude": -96.80,
    "returnPeriod": "25yr",
    "duration": 24,
    "timeInterval": 15,
    "distribution": "SCS Type III"
  }'

# Climate-adjusted rainfall projection
curl -X POST "https://geotapdata.com/api/v1/rainfall/climate/project" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 32.78,
    "longitude": -96.80,
    "returnPeriod": "100yr",
    "duration": 24,
    "horizon": "mid-century",
    "scenario": "SSP5-8.5"
  }'
```

#### Watershed & Hydrology

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/watershed/delineate` | Delineate watershed (USGS StreamStats) |
| GET | `/watershed/characteristics?lat={lat}&lng={lng}` | Basin parameters |
| GET | `/watershed/flow-statistics?lat={lat}&lng={lng}` | Peak/low flow estimates |
| GET | `/watershed/flowlines?bbox={w,s,e,n}` | Stream network (NHD) |
| GET | `/watershed/water-quality?bbox={w,s,e,n}` | Watershed water quality |

```bash
# Delineate watershed from a pour point
curl -X POST "https://geotapdata.com/api/v1/watershed/delineate" \
  -H "Content-Type: application/json" \
  -d '{"lat": 36.12, "lng": -97.06}'
```

#### Hydrology Toolkit

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/hydrology/analyze` | Complete hydrologic analysis (CN, Tc, peak flow) |
| GET | `/hydrology/distributions` | Available rainfall distributions |
| GET | `/hydrology/distribution?lat={lat}&lon={lon}` | Recommended distribution |

#### Curve Number

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cn/lookup?nlcd={code}&hsg={group}` | Lookup CN for land use + soil |
| GET | `/cn/tables` | Complete CN lookup tables |
| POST | `/cn/analyze` | Weighted CN for catchment polygons |

```bash
# Lookup curve number for developed land on B soils
curl "https://geotapdata.com/api/v1/cn/lookup?nlcd=22&hsg=B"

# Calculate weighted CN for a catchment
curl -X POST "https://geotapdata.com/api/v1/cn/analyze" \
  -H "Content-Type: application/json" \
  -d '{"catchments": {"type": "FeatureCollection", "features": [...]}}'
```

#### Water Quality

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/water-quality/receiving-water` | EPA ATTAINS data with downstream trace |
| GET | `/water-quality/impairments?huc12={code}` | Impairments by HUC-12 |
| GET | `/water-quality/watershed?lat={lat}&lon={lon}` | Identify HUC-12 for a point |

#### Waterway Permits

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/waterway-permits/features` | Find streams, wetlands, waterbodies |
| POST | `/waterway-permits/analyze` | Determine required permits |

#### Monitoring Stations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stations?bbox={w,s,e,n}` | Find USGS/NOAA stations |
| GET | `/stations/search?q={query}` | Search by name or ID |
| GET | `/stations/types` | Available station types |
| GET | `/stations/watersheds?bbox={w,s,e,n}` | HUC watershed boundaries |
| GET | `/stations/watersheds/{hucCode}` | Specific watershed by HUC code |

#### Gage Intelligence

**Gauged sites** (requires USGS station ID):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/gage-intelligence/{siteId}/flood-frequency` | Bulletin 17C flood frequency |
| GET | `/gage-intelligence/{siteId}/flow-duration` | Flow duration curve |
| GET | `/gage-intelligence/{siteId}/low-flow` | 7Q10, 7Q2, harmonic mean |
| GET | `/gage-intelligence/{siteId}/storm-events` | Historical storm events |
| GET | `/gage-intelligence/{siteId}/storm-events/{eventId}` | Storm event detail |
| GET | `/gage-intelligence/{siteId}/storm-events/{eventId}/export` | Export for HEC-HMS |
| GET | `/gage-intelligence/{siteId}/summary` | Gage overview |
| GET | `/gage-intelligence/{siteId}/published-stats` | Official USGS GageStats |
| GET | `/gage-intelligence/{siteId}/compare` | Computed vs. published QA |

**Ungaged sites** (regional regression):

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/gage-intelligence/ungaged/estimate` | NSS flood frequency estimate |
| POST | `/gage-intelligence/ungaged/estimate-all` | All available statistics |
| GET | `/gage-intelligence/ungaged/regions?state={ST}` | NSS regions by state |
| GET | `/gage-intelligence/ungaged/parameters?state={ST}` | Required basin characteristics |

**Watershed similarity**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/gage-intelligence/similarity/find` | Find analog watersheds |
| POST | `/gage-intelligence/similarity/find-with-stats` | Similar watersheds + stats |
| POST | `/gage-intelligence/similarity/recommend-index` | Best reference gage |
| POST | `/gage-intelligence/similarity/transfer` | Transfer statistics (DA ratio) |

```bash
# Flood frequency at USGS gage 08158000 (Colorado River at Austin)
curl "https://geotapdata.com/api/v1/gage-intelligence/08158000/flood-frequency"

# 7Q10 low flow for NPDES permits
curl "https://geotapdata.com/api/v1/gage-intelligence/08158000/low-flow"

# Estimate flood frequency at an ungaged site
curl -X POST "https://geotapdata.com/api/v1/gage-intelligence/ungaged/estimate" \
  -H "Content-Type: application/json" \
  -d '{"state": "TX", "region": "4", "parameters": {"drainageArea": 10.5}}'
```

#### Elevation & Terrain

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/spatial/dem-stats?bbox={w,s,e,n}` | Min/max/mean elevation |
| GET | `/spatial/contours?bbox={w,s,e,n}` | Contour lines |
| GET | `/spatial/contour-intervals` | Available intervals |
| POST | `/spatial/dem-export` | Export DEM as GeoTIFF |
| POST | `/spatial/contours-export` | Export contours |
| GET | `/spatial/dem-availability?bbox={w,s,e,n}` | Check resolution availability |
| GET | `/spatial/dem-resolutions` | Available DEM resolutions |

#### Land Use

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/spatial/nlcd-export` | Export NLCD land cover (GeoTIFF or vector) |

#### Site Analysis & Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/site-analysis/report` | Comprehensive environmental report |
| GET | `/site-analysis/report/{jobId}` | Check report status |
| POST | `/constraints/report` | Environmental constraints assessment |
| GET | `/constraints/report/{jobId}` | Check constraints status |
| GET | `/constraints/config` | Constraint configuration options |
| POST | `/site-developability/report` | Developability score (0-100) |
| GET | `/site-developability/config` | Scoring methodology |

```bash
# Generate a full site analysis
curl -X POST "https://geotapdata.com/api/v1/site-analysis/report" \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": {"type": "Point", "coordinates": [-97.74, 30.27]},
    "projectName": "Oak Hill Development"
  }'

# Check status (reports take 30-60 seconds)
curl "https://geotapdata.com/api/v1/site-analysis/report/{jobId}"
```

#### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/export/config/options` | Available formats and CRS |
| POST | `/export` | Export data (GeoJSON, Shapefile, KML, CSV) |
| GET | `/export/{jobId}` | Check export status + download URL |
| GET | `/export/{jobId}/download` | Download exported file |

```bash
# Export flood zones and wetlands as a shapefile
curl -X POST "https://geotapdata.com/api/v1/export" \
  -H "Content-Type: application/json" \
  -d '{
    "layers": ["flood_zones", "wetlands"],
    "format": "shapefile",
    "geometry": {"type": "Polygon", "coordinates": [[...]]}
  }'
```

#### Satellite Imagery

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/spatial/satellite-export` | Export aerial imagery as GeoTIFF |
| GET | `/spatial/satellite-resolutions` | Available resolutions |

#### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API health check |
| GET | `/status` | All data source connectivity |
| GET | `/status/{apiName}` | Specific API status |
| GET | `/docs` | API documentation (JSON) |

---

## MCP Server

The MCP (Model Context Protocol) server wraps the REST API into **83 AI-native tools** that Claude, Cursor, Windsurf, and other AI assistants can call directly.

### Installation

#### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "geotap": {
      "command": "npx",
      "args": ["-y", "geotap-mcp-server"]
    }
  }
}
```

#### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "geotap": {
      "command": "npx",
      "args": ["-y", "geotap-mcp-server"]
    }
  }
}
```

#### Windsurf / Other MCP Clients

```bash
npm install -g geotap-mcp-server
geotap-mcp
```

### Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `GEOTAP_API_URL` | API base URL | `https://geotapdata.com/api/v1` |
| `GEOTAP_API_KEY` | Optional API key | (none — free tier) |

With API key:
```json
{
  "mcpServers": {
    "geotap": {
      "command": "npx",
      "args": ["-y", "geotap-mcp-server"],
      "env": {
        "GEOTAP_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### What You Can Ask

- *"What are the flood zones at 123 Main St, Austin TX?"*
- *"Is this property in a wetland?"*
- *"What soil types are on this site?"*
- *"What's the 100-year rainfall for Dallas?"*
- *"Delineate the watershed at this point"*
- *"Are there any EPA Superfund sites near here?"*
- *"What's the curve number for this drainage area?"*
- *"What are the peak flood flows for this stream?"*
- *"What's the 7Q10 low flow at this gauge?"*
- *"Generate a design storm hyetograph for a 25-year, 24-hour event"*
- *"How will climate change affect rainfall at this location?"*
- *"Run a full environmental site analysis for this parcel"*
- *"What permits do I need to build near this stream?"*
- *"Export this data as a shapefile"*

### Available Tools (83)

<details>
<summary>Spatial Queries (4)</summary>

- **get_environmental_data_for_area** — Query all 28+ data sources within a polygon
- **get_environmental_data_near_point** — Query all data sources near a lat/lng point
- **get_environmental_summary** — Quick feature counts per layer for an area
- **get_environmental_data_in_bbox** — Query data within a bounding box
</details>

<details>
<summary>Data Layers (3)</summary>

- **list_data_layers** — List all 28+ available data sources
- **get_layer_details** — Get metadata about a specific layer
- **get_layer_features** — Get features from a specific data layer
</details>

<details>
<summary>Rainfall & Precipitation (14)</summary>

- **get_rainfall_data** — NOAA Atlas 14 precipitation frequency estimates
- **get_idf_curves** — Intensity-Duration-Frequency curve data
- **generate_hyetograph** — Design storm rainfall distribution over time
- **export_hyetograph** — Export hyetograph as CSV/JSON for modeling software
- **list_rainfall_distributions** — All available temporal distribution types
- **get_rainfall_distribution** — Recommended SCS distribution for a location
- **get_climate_scenarios** — Available climate change scenarios and horizons
- **get_climate_change_factors** — Climate adjustment multipliers for a location
- **get_climate_change_rainfall_projection** — Future rainfall under climate scenarios
- **get_rainfall_uncertainty_bounds** — Atlas 14 confidence intervals
- **generate_uncertainty_envelope** — Monte Carlo uncertainty bands for design storms
- **run_rainfall_sensitivity_analysis** — Parameter sensitivity analysis
- **get_design_approaches** — Risk-based design confidence levels
- **check_rainfall_service_status** — NOAA Atlas 14 availability check
</details>

<details>
<summary>Watershed & Hydrology (5)</summary>

- **delineate_watershed** — Trace watershed boundary from a pour point (USGS StreamStats)
- **get_watershed_characteristics** — Basin physical/hydrologic parameters
- **get_flow_statistics** — Peak and low flow estimates (regional regression)
- **get_flowlines** — Stream network from NHD
- **get_watershed_water_quality** — Water quality in the containing watershed
</details>

<details>
<summary>Hydrology Toolkit (3)</summary>

- **analyze_hydrology** — Complete hydrologic analysis (CN, Tc, SCS runoff, peak flow)
- **get_hydrology_distributions** — Available rainfall distributions for analysis
- **get_hydrology_distribution_for_location** — Recommended distribution for a point
</details>

<details>
<summary>Curve Number / Runoff (3)</summary>

- **lookup_curve_number** — SCS CN for a land use + soil type combination
- **get_curve_number_tables** — Complete CN lookup tables
- **analyze_curve_numbers** — Weighted CN calculation for catchment areas
</details>

<details>
<summary>Water Quality (3)</summary>

- **get_water_quality** — EPA ATTAINS impairment data with downstream trace
- **get_water_impairments** — Quick impairment check by HUC-12
- **get_watershed_for_point** — Identify HUC-12 watershed for a location
</details>

<details>
<summary>Waterway Permits (2)</summary>

- **find_water_features** — Find streams, wetlands, waterbodies in an area
- **analyze_permit_requirements** — Determine required permits (Section 404, NPDES, etc.)
</details>

<details>
<summary>Elevation & Terrain (7)</summary>

- **get_elevation_stats** — Min/max/mean elevation (USGS 3DEP)
- **get_contour_lines** — Generate topographic contour lines
- **get_contour_interval_options** — Available contour intervals
- **export_dem** — Export DEM as GeoTIFF (1m/10m/30m)
- **export_contours** — Export contour lines as GeoJSON
- **check_dem_availability** — Check which resolutions are available
- **get_dem_resolution_options** — Available DEM resolutions
</details>

<details>
<summary>Land Use / Land Cover (1)</summary>

- **export_land_use** — NLCD land cover data (GeoTIFF or vector)
</details>

<details>
<summary>Monitoring Stations (3)</summary>

- **find_monitoring_stations** — Search for USGS/NOAA/EPA stations
- **search_stations** — Search stations by name or ID
- **get_station_types** — Available station type configurations
</details>

<details>
<summary>Gage Intelligence — Gauged Sites (9)</summary>

- **get_flood_frequency_analysis** — Bulletin 17C flood frequency at a USGS gauge
- **get_flow_duration_curve** — Flow duration curve and percentiles
- **get_low_flow_statistics** — 7Q10, 7Q2, harmonic mean (NPDES critical flows)
- **get_storm_events** — Detect and analyze historical storm events
- **get_storm_event_detail** — Detailed data for a specific storm event
- **export_storm_event_for_modeling** — Export storm event for HEC-HMS
- **get_gage_summary** — Quick overview of available data at a gauge
- **get_published_gage_statistics** — Official USGS GageStats values
- **compare_computed_vs_published_stats** — QA comparison of computed vs. published
</details>

<details>
<summary>Gage Intelligence — Ungaged Sites (4)</summary>

- **estimate_ungaged_flood_frequency** — NSS regional regression estimates
- **estimate_all_ungaged_statistics** — All available statistics for ungaged site
- **get_ungaged_nss_regions** — Available NSS regions by state
- **get_ungaged_required_parameters** — Required basin characteristics for estimation
</details>

<details>
<summary>Gage Intelligence — Watershed Similarity (4)</summary>

- **find_similar_watersheds** — Find analog gauged watersheds
- **find_similar_watersheds_with_stats** — Similar watersheds with published stats
- **recommend_index_gage** — Best reference gage for flow transfer
- **transfer_flood_statistics** — Transfer statistics via drainage area ratio
</details>

<details>
<summary>Site Analysis & Reports (7)</summary>

- **generate_site_analysis** — Comprehensive environmental site analysis
- **get_site_analysis_status** — Check analysis job status
- **generate_constraints_report** — Environmental constraints assessment
- **get_constraints_report_status** — Check constraints report status
- **get_constraints_config** — Available constraint configuration options
- **generate_developability_report** — Site development feasibility score (0-100)
- **get_developability_config** — Scoring methodology and options
</details>

<details>
<summary>Export (3)</summary>

- **get_export_options** — Available formats and CRS options
- **export_data** — Export to GeoJSON, Shapefile, KML, CSV, GeoPackage
- **get_export_status** — Check export job status
</details>

<details>
<summary>Utilities (8)</summary>

- **geocode_address** — Convert address to coordinates
- **check_api_status** — Check all data source connectivity
- **check_specific_api_status** — Check a specific API's status
- **get_firm_panels** — FEMA FIRM map panel numbers
- **get_huc_watersheds** — HUC watershed boundaries
- **get_huc_watershed_by_code** — Specific watershed by HUC code
- **export_satellite_imagery** — Aerial/satellite imagery as GeoTIFF
- **get_satellite_resolution_options** — Available imagery resolutions
</details>

---

## Use Cases

### Civil & Environmental Engineering
- Stormwater design: rainfall (Atlas 14, IDF curves, hyetographs), curve numbers, time of concentration, peak discharge
- Flood analysis: Bulletin 17C flood frequency, flow duration curves, regional regression estimates
- Watershed delineation and hydrologic modeling inputs (HEC-HMS, SWMM)
- Low-flow analysis for NPDES permits (7Q10, 7Q2, harmonic mean flow)
- Ungaged site estimation using NSS regression equations and watershed similarity
- Climate-adjusted design storms for infrastructure resilience

### Real Estate & Development
- Environmental due diligence for property transactions
- Site feasibility and developability scoring (0-100 scale)
- Flood zone, wetland, and contamination screening
- Permit pathway analysis (Section 404, NPDES, floodplain development)

### Environmental Consulting
- Phase I ESA desktop data gathering (EPA sites, water quality)
- Wetland delineation support (NWI + soils + hydrology)
- Endangered species habitat screening (USFWS critical habitat)
- Water quality impairment assessment (EPA ATTAINS 303(d) list)

### AI-Powered Research
- Natural language queries across 28+ federal databases
- Automated environmental screening reports
- Cross-agency data correlation and analysis

---

## Example Workflows

### Quick Site Screening
```
User: "What environmental concerns are there at 456 Oak Ave, Houston TX?"

1. geocode_address → get coordinates
2. get_environmental_data_near_point → flood zones, wetlands, soils, EPA sites
3. Summarize findings in plain language
```

### Stormwater Design Package
```
User: "I need a complete stormwater design package for this 50-acre site in Dallas"

1. geocode_address → coordinates
2. get_rainfall_data → Atlas 14 depths for all return periods
3. get_rainfall_distribution → SCS Type III for Dallas
4. generate_hyetograph → 25-year, 24-hour design storm
5. delineate_watershed → drainage area boundary
6. analyze_curve_numbers → weighted CN from land use + soils
7. analyze_hydrology → time of concentration + peak discharge
8. get_water_quality → receiving water impairments
9. analyze_permit_requirements → required permits
```

### Ungaged Flood Estimation
```
User: "What's the 100-year flood at 30.5, -97.8? There's no gauge there."

1. get_ungaged_nss_regions → find the NSS region for Texas
2. get_watershed_characteristics → get basin parameters
3. estimate_ungaged_flood_frequency → regional regression estimate
4. find_similar_watersheds_with_stats → validate with nearby gauged data
5. recommend_index_gage → find best reference gage
6. transfer_flood_statistics → drainage area ratio transfer for comparison
```

### Environmental Due Diligence
```
User: "Run full environmental due diligence on this 20-acre parcel"

1. generate_site_analysis → comprehensive environmental report
2. generate_developability_report → 0-100 feasibility score
3. find_water_features → jurisdictional waters on site
4. analyze_permit_requirements → permit pathway and costs
5. get_water_quality → downstream receiving water assessment
```

---

## Contributing

Contributions welcome! Please open an issue or pull request.

## License

MIT

## Links

- **Web App**: [geotapdata.com](https://geotapdata.com)
- **API Docs (JSON)**: [geotapdata.com/api/v1/docs](https://geotapdata.com/api/v1/docs)
- **Issues**: [GitHub Issues](https://github.com/jcholly/geotap-developer/issues)
- **npm**: [geotap-mcp-server](https://www.npmjs.com/package/geotap-mcp-server)
