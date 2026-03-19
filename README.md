# GeoTap MCP Server

Access **28+ US federal environmental and infrastructure data sources** from Claude, Cursor, Windsurf, and any AI tool that supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

GeoTap aggregates data from FEMA, USGS, EPA, NOAA, USDA, USFWS, DOT, Census, and more into a single API — and this MCP server makes all of it available as AI-native tools.

## What Can It Do?

Ask your AI assistant questions like:

- **"What are the flood zones at 123 Main St, Austin TX?"** — Queries FEMA flood zone data for the address
- **"Is this property in a wetland?"** — Checks NWI wetland boundaries from USFWS
- **"What soil types are on this site?"** — Returns USDA/NRCS soil survey data
- **"What's the 100-year rainfall for Dallas?"** — Gets NOAA Atlas 14 precipitation frequency data
- **"Delineate the watershed at this point"** — Uses USGS StreamStats to trace the drainage area
- **"Are there any EPA Superfund sites near here?"** — Searches EPA facility databases
- **"Run a full environmental site analysis for this parcel"** — Generates a comprehensive constraints report
- **"What's the curve number for this drainage area?"** — Calculates SCS/NRCS runoff coefficients
- **"What are the peak flood flows for this stream?"** — Returns statistical flood frequency estimates
- **"Show me USGS stream gauges near this location"** — Finds monitoring stations
- **"What water quality impairments exist in this watershed?"** — Queries EPA ATTAINS data
- **"Get elevation data for this site"** — Returns USGS 3DEP terrain statistics
- **"Export this data as a shapefile"** — Downloads GIS-ready data files

## Data Sources

| Agency | Data Available |
|--------|---------------|
| **FEMA** | Flood zones, FIRM panels, flood insurance rate maps |
| **USGS** | Elevation (3DEP), geology, streamgages, groundwater, land use (NLCD), StreamStats |
| **EPA** | Water quality (ATTAINS), Superfund sites, brownfields, TRI toxic releases |
| **NOAA** | Rainfall (Atlas 14), tide stations, climate projections, weather stations |
| **USDA/NRCS** | Soils (SSURGO), curve numbers, hydrologic soil groups |
| **USFWS** | Wetlands (NWI), endangered species, critical habitat |
| **DOT** | Bridges, tunnels, National Bridge Inventory |
| **Census** | Demographics, boundaries, TIGER geographic data |
| **USACE** | Dams, levees, navigation channels |
| **Other** | Power plants, mines, tribal lands, and more |

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

## Available Tools (34)

### Spatial Queries
- **get_environmental_data_for_area** — Query all environmental data within a polygon (flood zones, wetlands, soils, EPA sites, endangered species, etc.)
- **get_environmental_data_near_point** — Query all environmental data near a lat/lng point
- **get_environmental_summary** — Quick feature counts per layer for an area

### Data Layers
- **list_data_layers** — List all 28+ available data sources
- **get_layer_features** — Get features from a specific data layer

### Rainfall & Precipitation
- **get_rainfall_data** — NOAA Atlas 14 precipitation frequency estimates
- **get_idf_curves** — Intensity-Duration-Frequency curve data
- **generate_hyetograph** — Design storm rainfall distribution over time
- **get_rainfall_distribution** — Recommended SCS distribution type for a location
- **get_climate_change_rainfall_projection** — Future rainfall under climate scenarios

### Watershed & Hydrology
- **delineate_watershed** — Trace watershed boundary from a pour point (USGS StreamStats)
- **get_watershed_characteristics** — Basin physical/hydrologic parameters
- **get_flow_statistics** — Peak and low flow estimates (regional regression)

### Curve Number / Runoff
- **lookup_curve_number** — SCS CN for a land use + soil type combination
- **analyze_curve_numbers** — Weighted CN calculation for catchment areas

### Water Quality
- **get_water_quality** — EPA ATTAINS impairment data with downstream trace
- **get_water_impairments** — Quick impairment check by HUC-12

### Elevation & Terrain
- **get_elevation_stats** — Min/max/mean elevation for an area (USGS 3DEP)
- **get_contour_lines** — Generate topographic contour lines
- **export_dem** — Export Digital Elevation Model as GeoTIFF

### Land Use / Land Cover
- **export_land_use** — NLCD land cover data (GeoTIFF or vector)

### Monitoring Stations
- **find_monitoring_stations** — Search for USGS/NOAA/EPA stations
- **search_stations** — Search stations by name or ID

### Gage Intelligence
- **get_flood_frequency_analysis** — Bulletin 17C flood frequency at a USGS gauge
- **get_storm_events** — Detect and analyze historical storm events

### Site Analysis & Reports
- **generate_site_analysis** — Comprehensive environmental site analysis
- **generate_constraints_report** — Environmental constraints assessment
- **generate_developability_report** — Site development feasibility score

### Export
- **export_data** — Export to GeoJSON, Shapefile, KML, CSV, GeoPackage

### Utilities
- **geocode_address** — Convert address to coordinates
- **check_api_status** — Check API and data source connectivity
- **get_firm_panels** — FEMA FIRM map panel numbers
- **get_huc_watersheds** — HUC watershed boundaries
- **export_satellite_imagery** — Aerial/satellite imagery as GeoTIFF

## Use Cases

### Civil & Environmental Engineering
- Site constraint analysis for development projects
- Stormwater design (rainfall, curve numbers, hydrographs)
- Flood risk assessment and floodplain mapping
- Watershed delineation and hydrologic modeling inputs

### Real Estate & Development
- Environmental due diligence for property transactions
- Site feasibility and developability assessment
- Flood zone and wetland impact evaluation
- Regulatory constraint identification

### Environmental Consulting
- Phase I ESA data gathering (EPA sites, water quality)
- Wetland delineation support (NWI + soils + hydrology)
- Endangered species habitat screening
- Water quality impairment assessment

### Climate & Sustainability
- Climate-adjusted rainfall projections
- Flood frequency analysis under future scenarios
- Land use change analysis
- Environmental monitoring station data

### AI-Powered Research
- Natural language queries across 28+ federal databases
- Automated environmental screening reports
- Cross-agency data correlation and analysis

## Example Workflows

### Quick Site Screening
```
User: "What environmental concerns are there at 456 Oak Ave, Houston TX?"

The AI will:
1. Geocode the address → get coordinates
2. Query environmental data near that point → flood zones, wetlands, soils, EPA sites
3. Summarize findings in plain language
```

### Stormwater Design
```
User: "I need design storm data for a 25-year, 24-hour storm in Dallas"

The AI will:
1. Geocode "Dallas TX" → get coordinates
2. Get Atlas 14 rainfall data → 25-year, 24-hour depth
3. Determine rainfall distribution → SCS Type III
4. Generate hyetograph → rainfall over time for modeling
```

### Watershed Analysis
```
User: "Delineate the watershed at 30.25, -97.75 and calculate the curve number"

The AI will:
1. Delineate watershed → drainage boundary + area
2. Analyze curve numbers → weighted CN from land use + soils
3. Return complete watershed characterization
```

## Contributing

Contributions welcome! Please open an issue or pull request.

## License

MIT

## Links

- **Web App**: [geotap.us](https://geotap.us)
- **API Documentation**: [geotap.us/api/v1/docs](https://geotap.us/api/v1/docs)
- **Issues**: [GitHub Issues](https://github.com/jcholly/geotap-mcp-server/issues)
