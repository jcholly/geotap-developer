import { z } from 'zod';

/**
 * GeoTap MCP Tool Definitions — 68 tools
 *
 * Each tool wraps a GeoTap API endpoint. Tool descriptions are written to be
 * highly descriptive so that LLMs can accurately determine when to use each tool.
 *
 * Data sources include: FEMA (flood zones, FIRM panels), USGS (geology, streamgages,
 * groundwater, elevation, land use), EPA (water quality, impairments, Superfund,
 * brownfields, TRI), NOAA (rainfall, tide stations, climate), USDA/NRCS (soils,
 * curve numbers), USFWS (wetlands, endangered species), DOT (bridges, tunnels),
 * Census (demographics, boundaries), and more.
 */

export const tools = [
  // ═══════════════════════════════════════════════════════════════════
  // SPATIAL QUERIES — Query environmental data by geography
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'query_address',
    description: `The recommended starting tool for most queries. Geocodes a US address AND queries environmental data at that location in a single call. Returns flood zones, wetlands, soils, critical habitat, contamination sites, and more — with plain-English interpretations (e.g., "High-risk flood zone. Flood insurance required."). No geometry in response — just properties and interpretations. Response is always small (<5KB). Use this FIRST when the user provides an address. Only use geocode_address separately if you need coordinates for other tools.`,
    parameters: {
      address: z.string().describe('US street address (e.g., "123 Main St, Houston TX")'),
      layers: z.string().optional().describe('Comma-separated layer names. Defaults to: flood_zones, wetlands, soil_map_units, critical_habitat, protected_lands, brownfields, superfund, npdes_outfalls, sole_source_aquifers')
    },
    endpoint: '/query-address',
    method: 'GET'
  },
  {
    name: 'identify_features_at_point',
    description: `Identify what environmental features exist at an exact lat/lng point. Returns ONLY properties (no geometry) with plain-English interpretations. Response is always small (<5KB). Use this when you already have coordinates. For addresses, use query_address instead (it geocodes + queries in one call). Returns flood zones, wetlands, soils, critical habitat, protected lands, brownfields, Superfund, NPDES outfalls, and sole source aquifers by default.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lng: z.number().describe('Longitude (WGS84)'),
      layers: z.string().optional().describe('Comma-separated layer names (e.g., "flood_zones,wetlands,soil_map_units"). Defaults to key regulatory layers.')
    },
    endpoint: '/spatial/point',
    method: 'GET'
  },
  {
    name: 'get_environmental_data_for_area',
    description: `Query all available US federal environmental and infrastructure data within a geographic area (polygon). Returns features from 37 data sources. WARNING: responses can be very large (100KB-2MB+) in urban areas with full geometry. ALWAYS set geometry="none" unless the user specifically needs coordinates. Specify layers to reduce response size. For simple "what's at this location?" questions, use query_address or identify_features_at_point instead — they're faster and return <5KB.`,
    parameters: {
      polygon: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number())))
      }).describe('GeoJSON Polygon geometry defining the area of interest'),
      layers: z.array(z.string()).optional().describe('Optional array of specific layer names to query. If omitted, all layers are queried.'),
      geometry: z.enum(['none', 'simplified', 'full']).optional().describe('Geometry detail: "none" strips coordinates (smallest response), "simplified" reduces density, "full" returns complete geometry. Default: full. Use "none" when you only need properties.')
    },
    endpoint: '/spatial/in-polygon',
    method: 'POST'
  },
  {
    name: 'get_environmental_data_near_point',
    description: `Query environmental data near a lat/lng point within a radius. WARNING: responses can be very large (50KB-1MB+) with default settings. ALWAYS set geometry="none" and specify layers to keep responses manageable. For "what's AT this exact location?" use identify_features_at_point or query_address instead — they return <5KB. Only use this tool when the user specifically needs data within a radius (e.g., "what EPA sites are within 2 miles?").`,
    parameters: {
      lat: z.number().describe('Latitude of the center point (WGS84)'),
      lng: z.number().describe('Longitude of the center point (WGS84)'),
      radius: z.number().optional().describe('Search radius in kilometers (min: 0.01, default: 1)'),
      layers: z.string().optional().describe('Comma-separated layer names to query. If omitted, all layers are queried.'),
      geometry: z.enum(['none', 'simplified', 'full']).optional().describe('Geometry detail: "none" strips coordinates (smallest response), "simplified" reduces density, "full" returns complete geometry. Default: full. Use "none" when you only need properties.')
    },
    endpoint: '/spatial/near',
    method: 'GET'
  },
  {
    name: 'get_environmental_summary',
    description: `Get a quick count of environmental features within an area without returning full feature details. Returns the number of flood zones, wetlands, soil types, EPA sites, etc. found within the polygon. Use this tool for a fast overview of what environmental constraints exist in an area before doing a full detailed query. Much faster than get_environmental_data_for_area when you just need to know "how many?" rather than full details.`,
    parameters: {
      polygon: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.array(z.number())))
      }).describe('GeoJSON Polygon geometry defining the area of interest'),
      layers: z.array(z.string()).optional().describe('Optional array of specific layer names to query')
    },
    endpoint: '/spatial/summary',
    method: 'POST'
  },
  {
    name: 'get_environmental_data_in_bbox',
    description: `Query environmental data within a bounding box. WARNING: responses can be very large with full geometry. Set geometry="none" and specify layers to keep responses small. For point lookups, use identify_features_at_point instead.`,
    parameters: {
      bbox: z.string().describe('Bounding box as "west,south,east,north" in WGS84 coordinates'),
      layers: z.string().optional().describe('Comma-separated layer names to query'),
      geometry: z.enum(['none', 'simplified', 'full']).optional().describe('Geometry detail: "none" strips coordinates (smallest response), "simplified" reduces density, "full" returns complete geometry. Default: full.')
    },
    endpoint: '/spatial/bbox',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // DATA LAYERS — Browse and query specific data sources
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'list_data_layers',
    description: `List all available environmental and infrastructure data layers in GeoTap. Returns the full catalog of 37 data sources with their names, descriptions, and data providers. Use this tool when someone asks "what data do you have?" or "what sources are available?" or wants to know what types of environmental data can be queried. Includes layers from FEMA, USGS, EPA, NOAA, USDA, USFWS, DOT, Census, and more.`,
    parameters: {},
    endpoint: '/layers',
    method: 'GET'
  },
  {
    name: 'get_layer_details',
    description: `Get detailed metadata about a specific data layer including its description, data source, update frequency, and available attributes. Use this when you need to understand what a particular layer contains before querying it.`,
    parameters: {
      layerName: z.string().describe('Layer identifier (e.g., "flood_zones", "wetlands", "dem_elevation")')
    },
    endpoint: '/layers/{layerName}',
    method: 'GET'
  },
  {
    name: 'get_layer_features',
    description: `Get features from a specific data layer within a bounding box. Use this tool when you need data from one specific source (e.g., just flood zones, or just wetlands) rather than all sources at once.`,
    parameters: {
      layerName: z.string().describe('The layer identifier (e.g., "flood_zones", "wetlands", "dem_elevation", "nlcd_land_cover", "contours", "building_footprints", "stream_gauges", "tide_stations", "weather_alerts", "air_quality")'),
      bbox: z.string().describe('Bounding box as "west,south,east,north" in WGS84 coordinates'),
      geometry: z.enum(['none', 'simplified', 'full']).optional().describe('Geometry detail: "none" strips coordinates (smallest response), "simplified" reduces density, "full" returns complete geometry. Default: full.')
    },
    endpoint: '/layers/{layerName}/features',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // RAINFALL & PRECIPITATION — NOAA Atlas 14, design storms, climate
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'get_rainfall_data',
    description: `Get NOAA Atlas 14 precipitation frequency estimates for a US location. Returns rainfall depths and intensities for various storm durations (5 minutes to 60 days) and return periods (1-year to 1000-year). This is the standard rainfall data used in stormwater engineering, flood analysis, and hydrologic design across the United States. Use this tool when someone asks about rainfall amounts, precipitation frequency, design storms, or "how much rain falls at this location?" for engineering or planning purposes.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lon: z.number().describe('Longitude (WGS84)'),
      units: z.enum(['english', 'metric']).optional().describe('Unit system (default: english = inches, metric = millimeters)'),
      series: z.enum(['pds', 'ams']).optional().describe('Statistical series: pds (partial duration) or ams (annual maximum). Default: pds')
    },
    endpoint: '/rainfall/atlas14',
    method: 'GET'
  },
  {
    name: 'get_idf_curves',
    description: `Get Intensity-Duration-Frequency (IDF) curve data for a US location. IDF curves show rainfall intensity vs. storm duration for different return periods. Essential for stormwater design, drainage engineering, and hydraulic calculations. Returns data formatted for charting IDF curves. Use this tool when an engineer asks for IDF data or when designing stormwater infrastructure.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lon: z.number().describe('Longitude (WGS84)'),
      units: z.enum(['english', 'metric']).optional().describe('Unit system (default: english)'),
      series: z.enum(['pds', 'ams']).optional().describe('Statistical series (default: pds)'),
      returnPeriods: z.string().optional().describe('Comma-separated return periods in years (e.g., "2,5,10,25,50,100")')
    },
    endpoint: '/rainfall/atlas14/idf',
    method: 'GET'
  },
  {
    name: 'generate_hyetograph',
    description: `Generate a design storm hyetograph (rainfall over time) for a specific location, return period, and duration. A hyetograph shows how rainfall is distributed across a storm event and is required for hydrologic modeling (HEC-HMS, SWMM, etc.). Supports multiple rainfall distributions (SCS Type I, IA, II, III, Huff distributions, etc.). Use this tool when an engineer needs a design storm for modeling, or when someone asks how rainfall is distributed during a storm event.`,
    parameters: {
      latitude: z.number().describe('Latitude (WGS84)'),
      longitude: z.number().describe('Longitude (WGS84)'),
      returnPeriod: z.string().describe('Return period as string with "yr" suffix (e.g., "2yr", "5yr", "10yr", "25yr", "50yr", "100yr", "200yr", "500yr", "1000yr")'),
      duration: z.number().describe('Storm duration in hours (e.g., 1, 2, 6, 12, 24)'),
      timeInterval: z.number().describe('Time step in minutes (e.g., 5, 10, 15, 30, 60)'),
      distribution: z.string().describe('Rainfall distribution type (e.g., "SCS Type II", "SCS Type III", "Huff First Quartile")'),
      units: z.enum(['english', 'metric']).optional().describe('Unit system (default: english)')
    },
    endpoint: '/rainfall/hyetograph',
    method: 'POST'
  },
  {
    name: 'export_hyetograph',
    description: `Export a design storm hyetograph as CSV or JSON file. Use this after generating a hyetograph when the user needs the data in a downloadable format for import into HEC-HMS, SWMM, or other modeling software.`,
    parameters: {
      latitude: z.number().describe('Latitude (WGS84)'),
      longitude: z.number().describe('Longitude (WGS84)'),
      returnPeriod: z.string().describe('Return period (e.g., "25yr")'),
      duration: z.number().describe('Storm duration in hours'),
      timeInterval: z.number().describe('Time step in minutes'),
      distribution: z.string().describe('Rainfall distribution type'),
      units: z.enum(['english', 'metric']).optional().describe('Unit system'),
      format: z.enum(['csv', 'json']).describe('Export format')
    },
    endpoint: '/rainfall/export',
    method: 'POST'
  },
  {
    name: 'list_rainfall_distributions',
    description: `List all available rainfall temporal distribution types. Returns SCS distributions (Type I, IA, II, III), Huff quartile distributions, balanced storm, alternating block, and other methods. Use this to show users what distribution options are available for hyetograph generation.`,
    parameters: {},
    endpoint: '/rainfall/distributions',
    method: 'GET'
  },
  {
    name: 'get_rainfall_distribution',
    description: `Determine which rainfall distribution type (SCS Type I, IA, II, III, etc.) is appropriate for a given US location based on NOAA regional maps. Use this tool before generating a hyetograph if you don't know which distribution to use. Different regions of the US use different standard rainfall distributions for engineering design.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lon: z.number().describe('Longitude (WGS84)')
    },
    endpoint: '/rainfall/recommend',
    method: 'GET'
  },
  {
    name: 'get_climate_scenarios',
    description: `List available climate change scenarios and time horizons for rainfall projections. Returns SSP scenarios (SSP2-4.5 moderate, SSP5-8.5 high emissions) and time horizons (current, mid-century 2040-2069, late-century 2070-2099). Use this to understand what climate projection options are available.`,
    parameters: {},
    endpoint: '/rainfall/climate/scenarios',
    method: 'GET'
  },
  {
    name: 'get_climate_change_factors',
    description: `Get climate change adjustment factors for a location. Returns the multiplier to apply to current Atlas 14 rainfall depths to estimate future precipitation under different climate scenarios. Based on CMIP6 climate model ensembles.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lon: z.number().describe('Longitude (WGS84)'),
      horizon: z.string().describe('Time horizon: "current", "mid-century", or "late-century"'),
      scenario: z.string().describe('Climate scenario: "SSP2-4.5" or "SSP5-8.5"')
    },
    endpoint: '/rainfall/climate/factors',
    method: 'GET'
  },
  {
    name: 'get_climate_change_rainfall_projection',
    description: `Apply climate change projections to Atlas 14 rainfall data for a US location. Returns adjusted precipitation depths under different climate scenarios (SSP2-4.5, SSP5-8.5) and future time horizons. Use this tool when someone asks about future rainfall under climate change, or when designing infrastructure that needs to account for changing precipitation patterns.`,
    parameters: {
      latitude: z.number().describe('Latitude (WGS84)'),
      longitude: z.number().describe('Longitude (WGS84)'),
      returnPeriod: z.string().describe('Return period as string with "yr" suffix (e.g., "100yr")'),
      duration: z.number().describe('Storm duration in hours'),
      horizon: z.string().describe('Future time horizon: "current", "mid-century", or "late-century"'),
      scenario: z.string().describe('Climate scenario (e.g., "SSP2-4.5", "SSP5-8.5")'),
      units: z.enum(['english', 'metric']).optional().describe('Unit system (default: english)')
    },
    endpoint: '/rainfall/climate/project',
    method: 'POST'
  },
  {
    name: 'get_rainfall_uncertainty_bounds',
    description: `Get Atlas 14 confidence interval bounds (lower, mean, upper) for a specific return period and duration. Shows the statistical uncertainty in the precipitation estimate. Use this when an engineer needs to understand the range of possible rainfall values for conservative or risk-based design.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lon: z.number().describe('Longitude (WGS84)'),
      returnPeriod: z.string().describe('Return period (e.g., "100yr")'),
      duration: z.string().describe('Duration key (e.g., "24hr", "6hr", "1hr")'),
      units: z.enum(['english', 'metric']).optional().describe('Unit system')
    },
    endpoint: '/rainfall/uncertainty/bounds',
    method: 'GET'
  },
  {
    name: 'generate_uncertainty_envelope',
    description: `Generate a Monte Carlo uncertainty envelope for a design storm hyetograph. Produces P5 through P95 percentile bands showing the range of possible storm patterns given Atlas 14 confidence intervals. Use this for risk-based stormwater design where understanding the range of possible outcomes matters (e.g., critical infrastructure, dam spillways).`,
    parameters: {
      latitude: z.number().describe('Latitude (WGS84)'),
      longitude: z.number().describe('Longitude (WGS84)'),
      returnPeriod: z.string().describe('Return period (e.g., "100yr")'),
      duration: z.number().describe('Storm duration in hours'),
      timeInterval: z.number().describe('Time step in minutes'),
      distribution: z.string().describe('Rainfall distribution type'),
      units: z.enum(['english', 'metric']).optional().describe('Unit system'),
      nSamples: z.number().optional().describe('Number of Monte Carlo samples (default: 500)')
    },
    endpoint: '/rainfall/uncertainty/envelope',
    method: 'POST'
  },
  {
    name: 'run_rainfall_sensitivity_analysis',
    description: `Run sensitivity analysis on storm parameters to understand which inputs have the greatest effect on peak intensity and total depth. Varies return period, duration, distribution type, and temporal position. Use this when an engineer wants to understand design storm sensitivity or justify parameter selections.`,
    parameters: {
      latitude: z.number().describe('Latitude (WGS84)'),
      longitude: z.number().describe('Longitude (WGS84)'),
      returnPeriod: z.string().describe('Base return period (e.g., "25yr")'),
      duration: z.number().describe('Base storm duration in hours'),
      timeInterval: z.number().describe('Time step in minutes'),
      distribution: z.string().describe('Base rainfall distribution type'),
      units: z.enum(['english', 'metric']).optional().describe('Unit system')
    },
    endpoint: '/rainfall/uncertainty/sensitivity',
    method: 'POST'
  },
  {
    name: 'get_design_approaches',
    description: `List available design approaches for handling Atlas 14 uncertainty (lower bound, mean, upper bound, 75th percentile). Each approach has a different risk level. Use this to help engineers choose the appropriate design confidence level.`,
    parameters: {},
    endpoint: '/rainfall/uncertainty/approaches',
    method: 'GET'
  },
  {
    name: 'check_rainfall_service_status',
    description: `Check the status of the NOAA Atlas 14 service and rainfall data availability. Returns whether the service is responding and any known issues.`,
    parameters: {},
    endpoint: '/rainfall/status',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // WATERSHED & HYDROLOGY — Watershed delineation, flow, characteristics
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'delineate_watershed',
    description: `Delineate (trace) the watershed boundary for a given pour point location using USGS StreamStats. Returns the drainage area boundary as a GeoJSON polygon along with basin characteristics (area, slope, precipitation, land use, etc.). A watershed is the area of land that drains to a specific point. Use this tool when someone asks "what is the drainage area?" or "delineate the watershed" for a point, or when calculating stormwater runoff for a site.`,
    parameters: {
      lat: z.number().describe('Latitude of the pour point / outlet (WGS84)'),
      lng: z.number().describe('Longitude of the pour point / outlet (WGS84)')
    },
    endpoint: '/watershed/delineate',
    method: 'POST'
  },
  {
    name: 'get_watershed_characteristics',
    description: `Get physical and hydrologic characteristics for a watershed at a given location. Returns drainage area, mean basin slope, mean annual precipitation, percent impervious, percent forest, and other characteristics used in hydrologic calculations. Use this when you need basin parameters for flood analysis, curve number calculations, or hydrologic modeling.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lng: z.number().describe('Longitude (WGS84)'),
      region: z.string().optional().describe('StreamStats region code (auto-detected if omitted)')
    },
    endpoint: '/watershed/characteristics',
    method: 'GET'
  },
  {
    name: 'get_flow_statistics',
    description: `Get peak flow and low flow statistics for a location using USGS regional regression equations. Returns estimated peak flows for various return periods (2-year through 500-year) and low flow statistics (7Q10, etc.). These are used for bridge/culvert sizing, floodplain analysis, and water supply planning. Use this tool when someone asks "what is the 100-year flood flow?" or needs design flows for a stream crossing.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lng: z.number().describe('Longitude (WGS84)'),
      region: z.string().optional().describe('StreamStats region code (auto-detected if omitted)'),
      drainageArea: z.number().optional().describe('Known drainage area in square miles (improves accuracy)')
    },
    endpoint: '/watershed/flow-statistics',
    method: 'GET'
  },
  {
    name: 'get_flowlines',
    description: `Get stream flowlines (rivers, creeks, channels) within a bounding box from the National Hydrography Dataset (NHD). Returns GeoJSON line features representing the stream network. Use this when someone needs to see streams near a location or understand the drainage network.`,
    parameters: {
      bbox: z.string().describe('Bounding box as "west,south,east,north" in WGS84 coordinates')
    },
    endpoint: '/watershed/flowlines',
    method: 'GET'
  },
  {
    name: 'get_watershed_water_quality',
    description: `Get water quality impairment status for the watershed containing a bounding box. Returns 303(d) listed impaired waters, pollutants of concern, and designated use impairments. Combines NHD watershed lookup with EPA ATTAINS data.`,
    parameters: {
      bbox: z.string().describe('Bounding box as "west,south,east,north"'),
      huc12: z.string().optional().describe('Optional HUC-12 code if already known')
    },
    endpoint: '/watershed/water-quality',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // HYDROLOGY TOOLKIT — Engineering calculations (Rational, SCS, TR-55)
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'analyze_hydrology',
    description: `Run comprehensive hydrologic analysis on one or more catchment areas. Calculates composite curve numbers, time of concentration, SCS runoff depth, and peak discharge using multiple methods (Rational Method, SCS TR-55, regression equations). This is the all-in-one hydrology tool — give it catchment polygons and it returns everything needed for stormwater design. Use this when an engineer needs complete hydrologic calculations for drainage areas.`,
    parameters: {
      catchments: z.any().describe('GeoJSON FeatureCollection of catchment polygons'),
      options: z.any().optional().describe('Analysis options: {hydrologicCondition, dualHSGTreatment, returnPeriods, durations}')
    },
    endpoint: '/hydrology/analyze',
    method: 'POST'
  },
  {
    name: 'get_hydrology_distributions',
    description: `List available rainfall distribution types for hydrologic analysis. Returns distribution names and regions where each applies.`,
    parameters: {},
    endpoint: '/hydrology/distributions',
    method: 'GET'
  },
  {
    name: 'get_hydrology_distribution_for_location',
    description: `Determine the appropriate rainfall distribution type for a specific location. Returns the recommended SCS distribution (Type I, IA, II, III) based on the location's NOAA rainfall region.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lon: z.number().describe('Longitude (WGS84)')
    },
    endpoint: '/hydrology/distribution',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // CURVE NUMBER — SCS/NRCS runoff estimation
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'lookup_curve_number',
    description: `Look up the SCS/NRCS Curve Number for a specific land use and soil type combination. The Curve Number (CN) is used to estimate stormwater runoff volume from rainfall. Returns the CN value based on NLCD land cover classification and Hydrologic Soil Group (A, B, C, D). Use this tool when someone asks about runoff calculations, curve numbers, or stormwater volume estimation for a specific land use and soil type.`,
    parameters: {
      nlcd: z.number().describe('NLCD land cover code (e.g., 21=Developed Open Space, 22=Low Intensity, 23=Medium Intensity, 24=High Intensity, 41=Deciduous Forest, 82=Cultivated Crops)'),
      hsg: z.string().describe('Hydrologic Soil Group (A, B, C, or D). A=sandy/well-drained, D=clay/poorly-drained'),
      condition: z.string().optional().describe('Antecedent moisture condition: "good", "fair", or "poor" (default: good)')
    },
    endpoint: '/cn/lookup',
    method: 'GET'
  },
  {
    name: 'get_curve_number_tables',
    description: `Get the complete SCS/NRCS curve number lookup tables. Returns CN values for all land use and hydrologic soil group combinations. Use this to show users the full reference table or when multiple lookups are needed at once.`,
    parameters: {},
    endpoint: '/cn/tables',
    method: 'GET'
  },
  {
    name: 'analyze_curve_numbers',
    description: `Calculate weighted Curve Numbers for one or more catchment areas using satellite land use data (NLCD) and USDA soil survey data (SSURGO). Automatically determines the land use and soil type within each catchment and computes the area-weighted CN. Uses multi-source classification: NWI wetlands (highest priority), NLCD land cover, building footprints for impervious refinement, and FEMA flood zones for HSG adjustment. Returns composite CN, pervious CN, impervious percentage, dominant HSG, dominant land use, wetland percentage, and cell-by-cell breakdown.`,
    parameters: {
      catchments: z.any().describe('GeoJSON FeatureCollection of catchment polygons to analyze'),
      options: z.object({
        hydrologicCondition: z.string().optional().describe('Antecedent moisture: "good", "fair", or "poor"'),
        dualHSGTreatment: z.string().optional().describe('How to handle dual HSG soils: "undrained" or "drained"')
      }).optional().describe('Analysis options')
    },
    endpoint: '/cn/analyze',
    method: 'POST'
  },

  // ═══════════════════════════════════════════════════════════════════
  // WATER QUALITY — EPA ATTAINS, impairments, receiving waters
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'get_water_quality',
    description: `Get water quality impairment data for a location from the EPA ATTAINS database. Returns information about impaired waterbodies (303(d) listed), pollutants of concern, designated uses, and assessment status. Includes downstream trace to find the nearest receiving water. Use this tool when someone asks about water quality, pollution, impaired streams/rivers, Clean Water Act compliance, NPDES permits, or stormwater discharge concerns for a location.`,
    parameters: {
      location: z.any().describe('GeoJSON Point or Polygon geometry for the area of interest'),
      options: z.object({
        includeDownstream: z.boolean().optional().describe('Trace downstream to find receiving water (default: true)'),
        radiusKm: z.number().optional().describe('Search radius in km (default: 5)')
      }).optional()
    },
    endpoint: '/water-quality/receiving-water',
    method: 'POST'
  },
  {
    name: 'get_water_impairments',
    description: `Quick check for water quality impairments by HUC-12 watershed code. Returns 303(d) listed impaired waterbodies and their pollutants within the specified HUC-12 watershed. Faster than get_water_quality when you already know the HUC-12 code.`,
    parameters: {
      huc12: z.string().describe('12-digit HUC watershed code')
    },
    endpoint: '/water-quality/impairments',
    method: 'GET'
  },
  {
    name: 'get_watershed_for_point',
    description: `Identify which HUC-12 watershed a point falls within. Returns the watershed boundary, HUC code, and name. Use this as a first step when you need to look up water quality impairments or other watershed-level data for a location.`,
    parameters: {
      lat: z.number().describe('Latitude (WGS84)'),
      lon: z.number().describe('Longitude (WGS84)')
    },
    endpoint: '/water-quality/watershed',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // WATERWAY PERMITS — Regulatory permit analysis
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'find_water_features',
    description: `Find streams, wetlands, and waterbodies within an area for permit analysis. Returns NHD flowlines, NWI wetlands, and other jurisdictional water features with their classifications. Use this as the first step in waterway permit analysis — identify what water features exist on or near a site before determining permit requirements.`,
    parameters: {
      polygon: z.any().describe('GeoJSON Polygon geometry for the area of interest')
    },
    endpoint: '/waterway-permits/features',
    method: 'POST'
  },
  {
    name: 'analyze_permit_requirements',
    description: `Analyze what environmental permits are required for a proposed activity near water features. Given selected water features and an activity type, returns required permits (USACE Section 404, NPDES, Floodplain Development, Stream Buffer Variance, Wetland Delineation, State 401 Certification), estimated timelines, and typical costs. Activity types include: crossing, utility_crossing, stormwater_discharge, wetland_fill, bank_stabilization, adjacent_construction. Use this when someone asks "what permits do I need?" for construction near water.`,
    parameters: {
      selectedFeatures: z.any().describe('Array of water feature objects from find_water_features'),
      activityType: z.enum(['crossing', 'utility_crossing', 'stormwater_discharge', 'wetland_fill', 'bank_stabilization', 'adjacent_construction']).describe('Type of proposed activity'),
      location: z.any().optional().describe('GeoJSON Point for the activity location')
    },
    endpoint: '/waterway-permits/analyze',
    method: 'POST'
  },

  // ═══════════════════════════════════════════════════════════════════
  // ELEVATION & TERRAIN — USGS 3DEP elevation, contours, DEM
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'get_elevation_stats',
    description: `Get elevation statistics (min, max, mean, range) for a bounding box area using USGS 3DEP elevation data. Available at 1m, 10m, and 30m resolution. Use this tool when someone asks about terrain, elevation, topography, or relief for an area. Good for understanding whether a site is flat or hilly.`,
    parameters: {
      bbox: z.string().describe('Bounding box as "west,south,east,north" in WGS84 coordinates')
    },
    endpoint: '/spatial/dem-stats',
    method: 'GET'
  },
  {
    name: 'get_contour_lines',
    description: `Generate elevation contour lines for a bounding box area from USGS 3DEP data. Returns GeoJSON contour lines at specified elevation intervals. Use this tool when someone needs topographic contours for site grading, drainage design, or understanding terrain.`,
    parameters: {
      bbox: z.string().describe('Bounding box as "west,south,east,north" in WGS84 coordinates'),
      interval: z.number().optional().describe('Contour interval in feet (default: 2)')
    },
    endpoint: '/spatial/contours',
    method: 'GET'
  },
  {
    name: 'get_contour_interval_options',
    description: `Get available contour interval options for topographic contour generation. Returns supported intervals with descriptions.`,
    parameters: {},
    endpoint: '/spatial/contour-intervals',
    method: 'GET'
  },
  {
    name: 'export_dem',
    description: `Export a Digital Elevation Model (DEM) as a GeoTIFF file for a polygon area. Supports 1m, 10m, and 30m USGS 3DEP resolution. The GeoTIFF can be used in GIS software (ArcGIS, QGIS) or hydrologic models.`,
    parameters: {
      polygon: z.any().describe('GeoJSON Polygon geometry'),
      resolution: z.enum(['1m', '10m', '30m']).optional().describe('DEM resolution (default: 10m)'),
      targetCrs: z.string().optional().describe('Target coordinate reference system (e.g., "EPSG:2277")'),
      convertToFeet: z.boolean().optional().describe('Convert elevation values to feet (default: false)'),
      clipToPolygon: z.boolean().optional().describe('Clip raster to polygon boundary (default: false)')
    },
    endpoint: '/spatial/dem-export',
    method: 'POST'
  },
  {
    name: 'export_contours',
    description: `Export elevation contour lines as GeoJSON for a polygon area. Returns vector contour lines that can be used in GIS or CAD software. Supports custom intervals and unit conversion.`,
    parameters: {
      polygon: z.any().describe('GeoJSON Polygon geometry'),
      interval: z.number().optional().describe('Contour interval'),
      intervalMeters: z.number().optional().describe('Contour interval in meters (alternative to feet)'),
      demResolution: z.enum(['1m', '10m', '30m']).optional().describe('DEM resolution to use'),
      convertToFeet: z.boolean().optional().describe('Label contours in feet (default: false)')
    },
    endpoint: '/spatial/contours-export',
    method: 'POST'
  },
  {
    name: 'check_dem_availability',
    description: `Check which DEM resolutions (1m, 10m, 30m) are available for a given area. Not all locations have 1m LiDAR coverage. Use this before requesting a specific resolution to avoid errors.`,
    parameters: {
      bbox: z.string().describe('Bounding box as "west,south,east,north"')
    },
    endpoint: '/spatial/dem-availability',
    method: 'GET'
  },
  {
    name: 'get_dem_resolution_options',
    description: `Get available DEM resolution options with descriptions. Returns the resolutions supported by USGS 3DEP.`,
    parameters: {},
    endpoint: '/spatial/dem-resolutions',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // LAND USE / LAND COVER — NLCD data
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'export_land_use',
    description: `Export NLCD (National Land Cover Database) land use / land cover data for a polygon area. Returns either a GeoTIFF raster or polygonized vector features with NLCD classification codes. NLCD categories include: Open Water, Developed (4 intensities), Barren Land, Forest (3 types), Shrubland, Herbaceous, Planted/Cultivated, Wetlands (2 types). Use this tool when someone asks about land use, land cover, impervious surface, or development intensity for an area.`,
    parameters: {
      polygon: z.any().describe('GeoJSON Polygon geometry'),
      format: z.enum(['geotiff', 'polygons']).optional().describe('Output format (default: geotiff)')
    },
    endpoint: '/spatial/nlcd-export',
    method: 'POST'
  },

  // ═══════════════════════════════════════════════════════════════════
  // MONITORING STATIONS — USGS, NOAA, tide, groundwater
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'find_monitoring_stations',
    description: `Search for environmental monitoring stations (USGS streamgages, groundwater wells, NOAA weather stations, NOAA tide gauges, water quality stations) near a location or within a bounding box. Returns station IDs, locations, types, and current status. Use this tool when someone asks about stream gauges, weather stations, water level monitoring, or real-time environmental data collection points near a location.`,
    parameters: {
      bbox: z.string().optional().describe('Bounding box as "west,south,east,north"'),
      source: z.string().optional().describe('Data source filter (e.g., "usgs", "noaa")'),
      type: z.string().optional().describe('Station type filter (e.g., "stream_gage", "groundwater", "tide", "precipitation", "camera")'),
      state: z.string().optional().describe('US state code (e.g., "TX", "CA")'),
      limit: z.number().optional().describe('Maximum number of stations to return')
    },
    endpoint: '/stations',
    method: 'GET'
  },
  {
    name: 'search_stations',
    description: `Search for monitoring stations by name or station ID. Use this tool when someone knows a specific station name or ID and wants to find it. Searches across USGS, NOAA, and other monitoring networks.`,
    parameters: {
      q: z.string().describe('Search query (station name or ID)'),
      type: z.string().optional().describe('Station type filter'),
      limit: z.number().optional().describe('Maximum results (default: 20)')
    },
    endpoint: '/stations/search',
    method: 'GET'
  },
  {
    name: 'get_station_types',
    description: `Get all available monitoring station types with their configurations including colors, icons, primary parameters measured, and data sources. Use this to understand what types of stations are available for querying.`,
    parameters: {},
    endpoint: '/stations/types',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // GAGE INTELLIGENCE — Advanced stream gage analysis
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'get_flood_frequency_analysis',
    description: `Perform Bulletin 17C flood frequency analysis for a USGS streamgage. Returns estimated peak flows for various return periods (2, 5, 10, 25, 50, 100, 200, 500 year) based on the station's historical annual peak flow record. Bulletin 17C is the federal standard method for flood frequency analysis in the US. Use this tool when someone needs statistical flood estimates at a gauged location.`,
    parameters: {
      siteId: z.string().describe('USGS station ID (e.g., "08158000" for Colorado River at Austin)'),
      minYears: z.number().optional().describe('Minimum years of record required (default: 10)')
    },
    endpoint: '/gage-intelligence/{siteId}/flood-frequency',
    method: 'GET'
  },
  {
    name: 'get_flow_duration_curve',
    description: `Calculate flow duration curve and percentiles for a USGS streamgage. A flow duration curve shows what percentage of time a given flow rate is equaled or exceeded. Returns percentiles (Q1, Q5, Q10, Q25, Q50, Q75, Q90, Q95, Q99), 100-point flow duration curve, and statistics. Essential for water supply planning, hydropower assessment, low-flow analysis, and environmental flow requirements.`,
    parameters: {
      siteId: z.string().describe('USGS station ID'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)')
    },
    endpoint: '/gage-intelligence/{siteId}/flow-duration',
    method: 'GET'
  },
  {
    name: 'get_low_flow_statistics',
    description: `Calculate low flow statistics for a USGS streamgage including 7-day 10-year low flow (7Q10), 7-day 2-year low flow (7Q2), harmonic mean flow, and monthly low flows. 7Q10 is the critical statistic used for wastewater discharge permits (NPDES) — it represents the lowest 7-day average flow expected once in 10 years. Use this when someone asks about low flows, drought flows, minimum flows, or NPDES permit requirements.`,
    parameters: {
      siteId: z.string().describe('USGS station ID'),
      minYears: z.number().optional().describe('Minimum years of record required')
    },
    endpoint: '/gage-intelligence/{siteId}/low-flow',
    method: 'GET'
  },
  {
    name: 'get_storm_events',
    description: `Detect and analyze individual storm events from a USGS streamgage's flow record. Returns identified storm events with peak flow, volume, duration, rise rate, and recession characteristics. Use this tool when someone wants to analyze historical storm response at a gauge, calibrate a hydrologic model, or understand how a watershed responds to rainfall.`,
    parameters: {
      siteId: z.string().describe('USGS station ID'),
      period: z.string().optional().describe('Time period (e.g., "1y", "5y", "10y"). Default: 1y'),
      minPeak: z.number().optional().describe('Minimum peak flow threshold in cfs')
    },
    endpoint: '/gage-intelligence/{siteId}/storm-events',
    method: 'GET'
  },
  {
    name: 'get_storm_event_detail',
    description: `Get detailed data for a specific storm event at a USGS streamgage. Returns the complete hydrograph, baseflow separation, rising/falling limbs, and event characteristics. Use this to examine a single storm in detail for model calibration or event analysis.`,
    parameters: {
      siteId: z.string().describe('USGS station ID'),
      eventId: z.string().describe('Storm event ID from get_storm_events results')
    },
    endpoint: '/gage-intelligence/{siteId}/storm-events/{eventId}',
    method: 'GET'
  },
  {
    name: 'export_storm_event_for_modeling',
    description: `Export a storm event hydrograph in HEC-HMS or other model-ready format. Use this when an engineer needs to import an observed storm event into hydrologic modeling software for calibration or validation.`,
    parameters: {
      siteId: z.string().describe('USGS station ID'),
      eventId: z.string().describe('Storm event ID'),
      format: z.string().optional().describe('Export format (default: "hec-hms")')
    },
    endpoint: '/gage-intelligence/{siteId}/storm-events/{eventId}/export',
    method: 'GET'
  },
  {
    name: 'get_gage_summary',
    description: `Get a quick summary of available data and key statistics for a USGS streamgage. Returns period of record, drainage area, mean/median/max flows, and what analyses are available. Good starting point before running more detailed analyses.`,
    parameters: {
      siteId: z.string().describe('USGS station ID')
    },
    endpoint: '/gage-intelligence/{siteId}/summary',
    method: 'GET'
  },
  {
    name: 'get_published_gage_statistics',
    description: `Get officially published statistics from USGS GageStats for a streamgage. These are peer-reviewed, published values that may differ from computed values. Use this when someone needs official/citable statistics rather than computed estimates.`,
    parameters: {
      siteId: z.string().describe('USGS station ID')
    },
    endpoint: '/gage-intelligence/{siteId}/published-stats',
    method: 'GET'
  },
  {
    name: 'compare_computed_vs_published_stats',
    description: `Compare computed flood frequency statistics with officially published USGS GageStats values. Highlights differences between your computed analysis and the peer-reviewed published values. Useful for quality assurance and understanding discrepancies.`,
    parameters: {
      siteId: z.string().describe('USGS station ID')
    },
    endpoint: '/gage-intelligence/{siteId}/compare',
    method: 'GET'
  },

  // ─── UNGAGED ESTIMATION ────────────────────────────────────────────
  {
    name: 'estimate_ungaged_flood_frequency',
    description: `Estimate flood frequency for an ungaged site (a location without a stream gauge) using USGS National Streamflow Statistics (NSS) regional regression equations. Requires basin characteristics (drainage area, slope, etc.) and the state/region. Use this when someone needs flood estimates at a location that doesn't have a stream gauge — which is the majority of locations.`,
    parameters: {
      state: z.string().describe('US state code (e.g., "TX", "VA")'),
      region: z.string().describe('NSS region code'),
      parameters: z.any().describe('Object of basin characteristics (e.g., {drainageArea: 10.5, meanBasinSlope: 3.2})')
    },
    endpoint: '/gage-intelligence/ungaged/estimate',
    method: 'POST'
  },
  {
    name: 'estimate_all_ungaged_statistics',
    description: `Estimate all available flow statistics for an ungaged site using USGS NSS regression equations. Returns peak flows, low flows, and flow duration percentiles — everything available for the given state and region. More comprehensive than estimate_ungaged_flood_frequency.`,
    parameters: {
      state: z.string().describe('US state code'),
      region: z.string().describe('NSS region code'),
      parameters: z.any().describe('Basin characteristics object')
    },
    endpoint: '/gage-intelligence/ungaged/estimate-all',
    method: 'POST'
  },
  {
    name: 'get_ungaged_nss_regions',
    description: `Get available NSS (National Streamflow Statistics) regions for a state. Each region has different regression equations for estimating flow statistics. Use this to determine what region code to use for ungaged estimation.`,
    parameters: {
      state: z.string().describe('US state code (e.g., "TX")')
    },
    endpoint: '/gage-intelligence/ungaged/regions',
    method: 'GET'
  },
  {
    name: 'get_ungaged_required_parameters',
    description: `Get the basin characteristics required for NSS regression equations in a given state and region. Returns the list of parameters needed (drainage area, slope, precipitation, etc.) with their units and valid ranges.`,
    parameters: {
      state: z.string().describe('US state code'),
      region: z.string().optional().describe('NSS region code')
    },
    endpoint: '/gage-intelligence/ungaged/parameters',
    method: 'GET'
  },

  // ─── WATERSHED SIMILARITY / ANALOG GAGES ──────────────────────────
  {
    name: 'find_similar_watersheds',
    description: `Find gauged watersheds with similar characteristics to an ungaged site. Uses physical similarity (drainage area, slope, precipitation, land use) to identify analog streams. Useful when regression equations aren't available or when you want to validate estimates with observed data from similar basins.`,
    parameters: {
      lat: z.number().describe('Latitude of the ungaged site'),
      lng: z.number().describe('Longitude of the ungaged site'),
      characteristics: z.any().optional().describe('Known basin characteristics to match on'),
      maxDistance: z.number().optional().describe('Maximum search distance in km'),
      limit: z.number().optional().describe('Maximum number of similar watersheds to return')
    },
    endpoint: '/gage-intelligence/similarity/find',
    method: 'POST'
  },
  {
    name: 'find_similar_watersheds_with_stats',
    description: `Find similar gauged watersheds AND include their published flow statistics. Combines watershed similarity search with GageStats data so you can directly see what flows have been observed at similar sites.`,
    parameters: {
      lat: z.number().describe('Latitude of the ungaged site'),
      lng: z.number().describe('Longitude of the ungaged site'),
      characteristics: z.any().optional().describe('Known basin characteristics'),
      maxDistance: z.number().optional().describe('Maximum search distance in km'),
      limit: z.number().optional().describe('Maximum similar watersheds')
    },
    endpoint: '/gage-intelligence/similarity/find-with-stats',
    method: 'POST'
  },
  {
    name: 'recommend_index_gage',
    description: `Find the best index gage for transferring flood statistics to an ungaged site. Evaluates nearby gages for similarity and data quality, then recommends the single best gage to use as a reference for flow estimation via drainage area ratio or other transfer methods.`,
    parameters: {
      lat: z.number().describe('Latitude of the ungaged site'),
      lng: z.number().describe('Longitude of the ungaged site'),
      drainageArea: z.number().optional().describe('Drainage area of ungaged site in sq mi')
    },
    endpoint: '/gage-intelligence/similarity/recommend-index',
    method: 'POST'
  },
  {
    name: 'transfer_flood_statistics',
    description: `Transfer flood frequency statistics from a gauged index gage to an ungaged site using drainage area ratio method. Given the index gage ID and the ungaged site's drainage area, scales the observed flood statistics proportionally. This is a common and accepted method for estimating flows at ungaged locations near a suitable reference gage.`,
    parameters: {
      indexSiteId: z.string().describe('USGS station ID of the index (reference) gage'),
      targetDrainageArea: z.number().describe('Drainage area of the ungaged site in square miles'),
      lat: z.number().optional().describe('Latitude of ungaged site'),
      lng: z.number().optional().describe('Longitude of ungaged site')
    },
    endpoint: '/gage-intelligence/similarity/transfer',
    method: 'POST'
  },

  // ═══════════════════════════════════════════════════════════════════
  // SITE ANALYSIS & REPORTS — Comprehensive reports, constraints, scoring
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'generate_site_analysis',
    description: `Generate a comprehensive environmental site analysis report for a project area. Queries all available data sources and produces a detailed report covering flood risk, wetlands, soils, geology, water quality, endangered species, hazardous sites, and regulatory constraints. Includes a developability score (0-100), permit pathway analysis, and engineering parameters (composite CN, HSG distribution). Use this tool when someone asks for a full environmental assessment, site analysis, due diligence report, or constraint analysis for a development project, real estate transaction, or environmental review.`,
    parameters: {
      geometry: z.any().describe('GeoJSON geometry (Point or Polygon) for the project site'),
      projectName: z.string().optional().describe('Project name for the report'),
      clientName: z.string().optional().describe('Client name for the report')
    },
    endpoint: '/site-analysis/report',
    method: 'POST'
  },
  {
    name: 'get_site_analysis_status',
    description: `Check the status of a site analysis report job. Site analysis can take 30-60 seconds to complete. Poll this endpoint to check progress and retrieve results when complete.`,
    parameters: {
      jobId: z.string().describe('Job ID returned from generate_site_analysis')
    },
    endpoint: '/site-analysis/report/{jobId}',
    method: 'GET'
  },
  {
    name: 'generate_constraints_report',
    description: `Generate an environmental constraints report for a development site. Identifies regulatory constraints (FEMA floodway, 100-year flood zone, 500-year flood zone, coastal V zone, NWI wetlands, hydric soils, stream buffers, steep slopes at multiple thresholds) and calculates constrained vs. developable area with proper overlap handling. Returns constraint severity levels, regulatory implications, and permit requirements per constraint.`,
    parameters: {
      geometry: z.any().describe('GeoJSON geometry (Point or Polygon) for the site'),
      projectName: z.string().optional().describe('Project name'),
      clientName: z.string().optional().describe('Client name'),
      options: z.any().optional().describe('Report options: {waterQuality: true/false, layers to include}')
    },
    endpoint: '/constraints/report',
    method: 'POST'
  },
  {
    name: 'get_constraints_report_status',
    description: `Check the status of a constraints report job and download when complete. Returns report data including all constraints, developable area analysis, and regulatory implications.`,
    parameters: {
      jobId: z.string().describe('Job ID returned from generate_constraints_report')
    },
    endpoint: '/constraints/report/{jobId}',
    method: 'GET'
  },
  {
    name: 'get_constraints_config',
    description: `Get available configuration options for constraints reports, including what constraint types can be analyzed and what report formats are available.`,
    parameters: {},
    endpoint: '/constraints/config',
    method: 'GET'
  },
  {
    name: 'generate_developability_report',
    description: `Generate a site developability assessment report. Evaluates how suitable a site is for development based on environmental constraints, soil conditions, flood risk, topography, and regulatory requirements. Returns a 0-100 developability score with ratings: 90-100 Minimal Constraints, 75-89 Low, 60-74 Moderate, 40-59 High, 0-39 Severe. Includes penalty breakdown showing exactly what constraints are reducing the score. Use this tool when someone asks "can I build on this site?" or needs a feasibility assessment for a property.`,
    parameters: {
      geometry: z.any().describe('GeoJSON geometry for the site'),
      projectName: z.string().optional().describe('Project name'),
      options: z.any().optional().describe('Assessment options')
    },
    endpoint: '/site-developability/report',
    method: 'POST'
  },
  {
    name: 'get_developability_config',
    description: `Get configuration options for site developability reports, including available constraint weights and scoring methodology.`,
    parameters: {},
    endpoint: '/site-developability/config',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT — Multi-format GIS data export
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'get_export_options',
    description: `Get available export formats (GeoJSON, Shapefile, CSV, KML, GeoPackage) and coordinate reference system options. Returns supported formats with descriptions and a list of common CRS codes.`,
    parameters: {},
    endpoint: '/export/config/options',
    method: 'GET'
  },
  {
    name: 'export_data',
    description: `Export environmental data layers to common GIS formats (GeoJSON, Shapefile, KML, CSV, GeoPackage). Supports CRS transformation, feature clipping to AOI, and raster inclusion (DEM, satellite, NLCD). Use this tool when someone needs to download data for use in GIS software, CAD, or other analysis tools.`,
    parameters: {
      layers: z.array(z.string()).describe('Layer names to export (required). Use list_data_layers to see available names.'),
      format: z.enum(['geojson', 'shapefile', 'kml', 'csv', 'geopackage']).describe('Output format'),
      crs: z.string().optional().describe('Target coordinate reference system (e.g., "EPSG:4326")'),
      geometry: z.any().optional().describe('GeoJSON geometry to clip export area'),
      options: z.any().optional().describe('Additional options: {dem: {resolution, convertToFeet}, satellite: {resolution}, nlcd: true, contours: {intervalMeters}}')
    },
    endpoint: '/export',
    method: 'POST'
  },
  {
    name: 'get_export_status',
    description: `Check the status of an export job. Export jobs can take time for large datasets or raster processing. Poll this endpoint to check when the download is ready.`,
    parameters: {
      jobId: z.string().describe('Job ID returned from export_data')
    },
    endpoint: '/export/{jobId}',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // GEOCODING — Address to coordinates
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'geocode_address',
    description: `Convert a US address or place name to geographic coordinates (latitude/longitude). Uses US Census geocoder for street addresses and Photon/Nominatim for place names. Use this tool first when someone provides an address, city name, or place name and you need coordinates to query other GeoTap tools. Returns lat/lng coordinates and a standardized address.`,
    parameters: {
      address: z.string().describe('Address or place name to geocode (e.g., "123 Main St, Austin TX" or "Lake Travis")')
    },
    endpoint: '/geocode',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // FEMA FLOOD MAPS
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'get_firm_panels',
    description: `Get FEMA Flood Insurance Rate Map (FIRM) panel numbers for an area. FIRM panels are the official flood maps used for flood insurance and floodplain regulation. Returns panel IDs that can be used to download the official FIRM map PDFs from FEMA. Use this tool when someone needs official FEMA flood map panel numbers or wants to reference specific FIRM panels.`,
    parameters: {
      bbox: z.string().describe('Bounding box as "west,south,east,north" in WGS84 coordinates')
    },
    endpoint: '/spatial/firm-panels',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // HUC WATERSHEDS — Hydrologic unit boundaries
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'get_huc_watersheds',
    description: `Get Hydrologic Unit Code (HUC) watershed boundaries for a bounding box area. Returns watershed polygons at HUC-8, HUC-10, or HUC-12 level. HUC watersheds are the standard geographic units for water resource management in the US. Use this tool when someone asks about watershed boundaries, HUC codes, or needs to identify which watershed a location is in.`,
    parameters: {
      bbox: z.string().describe('Bounding box as "west,south,east,north"'),
      hucLevel: z.enum(['8', '10', '12']).optional().describe('HUC level: 8 (subbasin), 10 (watershed), or 12 (subwatershed). Default: 12')
    },
    endpoint: '/stations/watersheds',
    method: 'GET'
  },
  {
    name: 'get_huc_watershed_by_code',
    description: `Get a specific HUC watershed boundary by its HUC code. Returns the watershed polygon, name, and area. Use this when you already know the HUC code and want its boundary.`,
    parameters: {
      hucCode: z.string().describe('HUC watershed code (8, 10, or 12 digits)')
    },
    endpoint: '/stations/watersheds/{hucCode}',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // SATELLITE IMAGERY
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'export_satellite_imagery',
    description: `Export satellite imagery as a GeoTIFF for a polygon area. Available at high, medium, and low resolution from USGS/NAIP aerial photography. Use this tool when someone needs aerial or satellite photos of a site for GIS analysis, site documentation, or visual assessment.`,
    parameters: {
      polygon: z.any().describe('GeoJSON Polygon geometry'),
      resolution: z.enum(['high', 'medium', 'low']).optional().describe('Image resolution (default: medium)'),
      targetCrs: z.string().optional().describe('Target coordinate reference system')
    },
    endpoint: '/spatial/satellite-export',
    method: 'POST'
  },
  {
    name: 'get_satellite_resolution_options',
    description: `Get available satellite imagery resolution options with their pixel sizes and coverage information.`,
    parameters: {},
    endpoint: '/spatial/satellite-resolutions',
    method: 'GET'
  },

  // ═══════════════════════════════════════════════════════════════════
  // HEALTH, STATUS & API INFO
  // ═══════════════════════════════════════════════════════════════════
  {
    name: 'check_api_status',
    description: `Check the health and status of the GeoTap API and all connected federal data sources. Returns connectivity status for each external API (FEMA, USGS, EPA, NOAA, etc.). Use this tool to verify which data sources are currently available before making queries.`,
    parameters: {},
    endpoint: '/status',
    method: 'GET'
  },
  {
    name: 'check_specific_api_status',
    description: `Check connectivity status for a specific external data source API. Faster than checking all APIs when you only care about one.`,
    parameters: {
      apiName: z.string().describe('API name to check (e.g., "fema", "usgs", "epa", "noaa", "nrcs")')
    },
    endpoint: '/status/{apiName}',
    method: 'GET'
  }
];
