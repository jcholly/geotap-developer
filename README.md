# GeoTap MCP Server

Access **28+ US federal environmental and infrastructure data sources** from Claude, Cursor, Windsurf, and any AI tool that supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

GeoTap aggregates data from FEMA, USGS, EPA, NOAA, USDA, USFWS, DOT, Census, and more into a single API — and this MCP server makes all of it available as **83 AI-native tools**.

## What Can It Do?

Ask your AI assistant questions like:

- **"What are the flood zones at 123 Main St, Austin TX?"** — Queries FEMA flood zone data
- **"Is this property in a wetland?"** — Checks NWI wetland boundaries from USFWS
- **"What soil types are on this site?"** — Returns USDA/NRCS soil survey data
- **"What's the 100-year rainfall for Dallas?"** — Gets NOAA Atlas 14 precipitation frequency
- **"Delineate the watershed at this point"** — Uses USGS StreamStats to trace the drainage area
- **"Are there any EPA Superfund sites near here?"** — Searches EPA facility databases
- **"Run a full environmental site analysis for this parcel"** — Generates a comprehensive constraints report
- **"What's the curve number for this drainage area?"** — Calculates SCS/NRCS runoff coefficients
- **"What are the peak flood flows for this stream?"** — Returns statistical flood frequency estimates
- **"Show me USGS stream gauges near this location"** — Finds monitoring stations
- **"What water quality impairments exist in this watershed?"** — Queries EPA ATTAINS data
- **"Get elevation data for this site"** — Returns USGS 3DEP terrain statistics
- **"Export this data as a shapefile"** — Downloads GIS-ready data files
- **"What permits do I need to build near this stream?"** — Analyzes waterway permit requirements
- **"Calculate time of concentration for this catchment"** — Runs TR-55 hydrology calculations
- **"What's the 7Q10 low flow at this gauge?"** — Returns critical low-flow statistics for NPDES permits
- **"Find similar watersheds to this ungaged site"** — Identifies analog gages for flow estimation
- **"Generate a design storm hyetograph for a 25-year, 24-hour event"** — Creates model-ready rainfall data
- **"How will climate change affect rainfall at this location?"** — Projects future precipitation under SSP scenarios
- **"What's the flow duration curve at this USGS gauge?"** — Calculates exceedance probabilities
- **"Run a sensitivity analysis on my design storm parameters"** — Quantifies uncertainty in storm inputs

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

## Installation

### Claude Desktop

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

### Cursor

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

### Manual / Other MCP Clients

```bash
# Install globally
npm install -g geotap-mcp-server

# Run
geotap-mcp
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEOTAP_API_URL` | GeoTap API base URL | `https://geotap.us/api/v1` |
| `GEOTAP_API_KEY` | Optional API key for authenticated access | (none — free tier) |

### With API Key (optional)

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

## Available Tools (83)

### Spatial Queries (4 tools)
- **get_environmental_data_for_area** — Query all 28+ data sources within a polygon
- **get_environmental_data_near_point** — Query all data sources near a lat/lng point
- **get_environmental_summary** — Quick feature counts per layer for an area
- **get_environmental_data_in_bbox** — Query data within a bounding box

### Data Layers (3 tools)
- **list_data_layers** — List all 28+ available data sources
- **get_layer_details** — Get metadata about a specific layer
- **get_layer_features** — Get features from a specific data layer

### Rainfall & Precipitation (12 tools)
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

### Watershed & Hydrology (5 tools)
- **delineate_watershed** — Trace watershed boundary from a pour point (USGS StreamStats)
- **get_watershed_characteristics** — Basin physical/hydrologic parameters
- **get_flow_statistics** — Peak and low flow estimates (regional regression)
- **get_flowlines** — Stream network from NHD
- **get_watershed_water_quality** — Water quality in the containing watershed

### Hydrology Toolkit (3 tools)
- **analyze_hydrology** — Complete hydrologic analysis (CN, Tc, SCS runoff, peak flow)
- **get_hydrology_distributions** — Available rainfall distributions for analysis
- **get_hydrology_distribution_for_location** — Recommended distribution for a point

### Curve Number / Runoff (3 tools)
- **lookup_curve_number** — SCS CN for a land use + soil type combination
- **get_curve_number_tables** — Complete CN lookup tables
- **analyze_curve_numbers** — Weighted CN calculation for catchment areas (multi-source)

### Water Quality (3 tools)
- **get_water_quality** — EPA ATTAINS impairment data with downstream trace
- **get_water_impairments** — Quick impairment check by HUC-12
- **get_watershed_for_point** — Identify HUC-12 watershed for a location

### Waterway Permits (2 tools)
- **find_water_features** — Find streams, wetlands, waterbodies in an area
- **analyze_permit_requirements** — Determine required permits (Section 404, NPDES, etc.)

### Elevation & Terrain (7 tools)
- **get_elevation_stats** — Min/max/mean elevation (USGS 3DEP)
- **get_contour_lines** — Generate topographic contour lines
- **get_contour_interval_options** — Available contour intervals
- **export_dem** — Export DEM as GeoTIFF (1m/10m/30m)
- **export_contours** — Export contour lines as GeoJSON
- **check_dem_availability** — Check which resolutions are available
- **get_dem_resolution_options** — Available DEM resolutions

### Land Use / Land Cover (1 tool)
- **export_land_use** — NLCD land cover data (GeoTIFF or vector)

### Monitoring Stations (3 tools)
- **find_monitoring_stations** — Search for USGS/NOAA/EPA stations
- **search_stations** — Search stations by name or ID
- **get_station_types** — Available station type configurations

### Gage Intelligence (17 tools)

#### Gauged Sites
- **get_flood_frequency_analysis** — Bulletin 17C flood frequency at a USGS gauge
- **get_flow_duration_curve** — Flow duration curve and percentiles
- **get_low_flow_statistics** — 7Q10, 7Q2, harmonic mean (NPDES critical flows)
- **get_storm_events** — Detect and analyze historical storm events
- **get_storm_event_detail** — Detailed data for a specific storm event
- **export_storm_event_for_modeling** — Export storm event for HEC-HMS
- **get_gage_summary** — Quick overview of available data at a gauge
- **get_published_gage_statistics** — Official USGS GageStats values
- **compare_computed_vs_published_stats** — QA comparison of computed vs. published

#### Ungaged Sites
- **estimate_ungaged_flood_frequency** — NSS regional regression estimates
- **estimate_all_ungaged_statistics** — All available statistics for ungaged site
- **get_ungaged_nss_regions** — Available NSS regions by state
- **get_ungaged_required_parameters** — Required basin characteristics for estimation

#### Watershed Similarity
- **find_similar_watersheds** — Find analog gauged watersheds
- **find_similar_watersheds_with_stats** — Similar watersheds with published stats
- **recommend_index_gage** — Best reference gage for flow transfer
- **transfer_flood_statistics** — Transfer statistics via drainage area ratio

### Site Analysis & Reports (7 tools)
- **generate_site_analysis** — Comprehensive environmental site analysis
- **get_site_analysis_status** — Check analysis job status
- **generate_constraints_report** — Environmental constraints assessment
- **get_constraints_report_status** — Check constraints report status
- **get_constraints_config** — Available constraint configuration options
- **generate_developability_report** — Site development feasibility score (0-100)
- **get_developability_config** — Scoring methodology and options

### Export (3 tools)
- **get_export_options** — Available formats and CRS options
- **export_data** — Export to GeoJSON, Shapefile, KML, CSV, GeoPackage
- **get_export_status** — Check export job status

### Utilities (5 tools)
- **geocode_address** — Convert address to coordinates
- **check_api_status** — Check all data source connectivity
- **check_specific_api_status** — Check a specific API's status
- **get_firm_panels** — FEMA FIRM map panel numbers
- **get_huc_watersheds** — HUC watershed boundaries
- **get_huc_watershed_by_code** — Specific watershed by HUC code
- **export_satellite_imagery** — Aerial/satellite imagery as GeoTIFF
- **get_satellite_resolution_options** — Available imagery resolutions

## Use Cases

### Civil & Environmental Engineering
- Stormwater design: rainfall (Atlas 14, IDF curves, hyetographs), curve numbers, time of concentration, peak discharge
- Flood analysis: Bulletin 17C flood frequency, flow duration curves, regional regression estimates
- Watershed delineation and hydrologic modeling inputs (HEC-HMS, SWMM)
- Low-flow analysis for NPDES permits (7Q10, 7Q2, harmonic mean flow)
- Ungaged site estimation using NSS regression equations and watershed similarity
- Climate-adjusted design storms for infrastructure resilience
- Uncertainty quantification for risk-based design

### Real Estate & Development
- Environmental due diligence for property transactions
- Site feasibility and developability scoring (0-100 scale)
- Flood zone, wetland, and contamination screening
- Permit pathway analysis (Section 404, NPDES, floodplain development)
- Constraint mapping with developable area calculation

### Environmental Consulting
- Phase I ESA desktop data gathering (EPA sites, water quality)
- Wetland delineation support (NWI + soils + hydrology)
- Endangered species habitat screening (USFWS critical habitat)
- Water quality impairment assessment (EPA ATTAINS 303(d) list)
- Stream buffer and waterway permit requirement analysis

### Climate & Sustainability
- Climate-adjusted rainfall projections (CMIP6, SSP2-4.5, SSP5-8.5)
- Flood frequency analysis under future scenarios
- Land use change analysis (NLCD multi-year comparison)
- Environmental monitoring station data and trends

### AI-Powered Research
- Natural language queries across 28+ federal databases
- Automated environmental screening reports
- Cross-agency data correlation and analysis
- Batch site analysis for portfolio screening

## Example Workflows

### Quick Site Screening
```
User: "What environmental concerns are there at 456 Oak Ave, Houston TX?"

The AI will:
1. geocode_address → get coordinates
2. get_environmental_data_near_point → flood zones, wetlands, soils, EPA sites
3. Summarize findings in plain language
```

### Stormwater Design Package
```
User: "I need a complete stormwater design package for this 50-acre site in Dallas"

The AI will:
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

The AI will:
1. get_ungaged_nss_regions → find the NSS region for Texas
2. get_watershed_characteristics → get basin parameters
3. estimate_ungaged_flood_frequency → regional regression estimate
4. find_similar_watersheds_with_stats → validate with nearby gauged data
5. recommend_index_gage → find best reference gage
6. transfer_flood_statistics → drainage area ratio transfer for comparison
```

### Environmental Due Diligence
```
User: "Run full environmental due diligence on this 20-acre parcel for a land purchase"

The AI will:
1. generate_site_analysis → comprehensive environmental report
2. generate_developability_report → 0-100 feasibility score
3. find_water_features → jurisdictional waters on site
4. analyze_permit_requirements → permit pathway and costs
5. get_water_quality → downstream receiving water assessment
```

## Contributing

Contributions welcome! Please open an issue or pull request.

## License

MIT

## Links

- **Web App**: [geotap.us](https://geotap.us)
- **API Documentation**: [geotap.us/api/v1/docs](https://geotap.us/api/v1/docs)
- **Issues**: [GitHub Issues](https://github.com/jcholly/geotap-mcp-server/issues)
