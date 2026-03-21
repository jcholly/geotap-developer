/**
 * Data source attribution for every MCP tool.
 *
 * Maps tool names → authoritative data sources so every response includes
 * provenance: which federal agency, what dataset, and a reference URL.
 */

const AGENCIES = {
  FEMA: { name: 'FEMA', fullName: 'Federal Emergency Management Agency' },
  USGS: { name: 'USGS', fullName: 'U.S. Geological Survey' },
  EPA: { name: 'EPA', fullName: 'U.S. Environmental Protection Agency' },
  NOAA: { name: 'NOAA', fullName: 'National Oceanic and Atmospheric Administration' },
  USDA: { name: 'USDA/NRCS', fullName: 'U.S. Department of Agriculture / Natural Resources Conservation Service' },
  USFWS: { name: 'USFWS', fullName: 'U.S. Fish and Wildlife Service' },
  DOT: { name: 'DOT', fullName: 'U.S. Department of Transportation' },
  CENSUS: { name: 'Census Bureau', fullName: 'U.S. Census Bureau' },
  USACE: { name: 'USACE', fullName: 'U.S. Army Corps of Engineers' },
};

const DATASETS = {
  atlas14: { dataset: 'Atlas 14 Precipitation Frequency Estimates', url: 'https://hdsc.nws.noaa.gov/pfds/' },
  cmip6: { dataset: 'CMIP6 Climate Model Ensemble', url: 'https://pcmdi.llnl.gov/CMIP6/' },
  streamstats: { dataset: 'StreamStats', url: 'https://streamstats.usgs.gov/' },
  nwis: { dataset: 'National Water Information System (NWIS)', url: 'https://waterdata.usgs.gov/nwis' },
  nss: { dataset: 'National Streamflow Statistics (NSS)', url: 'https://streamstats.usgs.gov/nss/' },
  gagestats: { dataset: 'GageStats', url: 'https://gagestats.waterdata.usgs.gov/' },
  nhd: { dataset: 'National Hydrography Dataset (NHD)', url: 'https://www.usgs.gov/national-hydrography/national-hydrography-dataset' },
  wbd: { dataset: 'Watershed Boundary Dataset (WBD)', url: 'https://www.usgs.gov/national-hydrography/watershed-boundary-dataset' },
  dep3: { dataset: '3D Elevation Program (3DEP)', url: 'https://www.usgs.gov/3d-elevation-program' },
  nlcd: { dataset: 'National Land Cover Database (NLCD)', url: 'https://www.mrlc.gov/' },
  attains: { dataset: 'ATTAINS (Assessment, TMDL Tracking and Implementation System)', url: 'https://www.epa.gov/waterdata/attains' },
  nfhl: { dataset: 'National Flood Hazard Layer (NFHL)', url: 'https://www.fema.gov/flood-maps/national-flood-hazard-layer' },
  nwi: { dataset: 'National Wetlands Inventory (NWI)', url: 'https://www.fws.gov/program/national-wetlands-inventory' },
  ssurgo: { dataset: 'SSURGO Soil Survey', url: 'https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo' },
  tr55: { dataset: 'TR-55 Urban Hydrology for Small Watersheds', url: 'https://www.nrcs.usda.gov/sites/default/files/2022-04/tr55.pdf' },
  naip: { dataset: 'National Agriculture Imagery Program (NAIP)', url: 'https://naip-usdaonline.hub.arcgis.com/' },
  census_geocoder: { dataset: 'Census Geocoder', url: 'https://geocoding.geo.census.gov/' },
};

function src(agency, ...datasetKeys) {
  return datasetKeys.map(key => ({
    agency: agency.name,
    agencyFullName: agency.fullName,
    dataset: DATASETS[key].dataset,
    url: DATASETS[key].url,
  }));
}

// Multi-source tools query many agencies at once
const MULTI_SOURCE = [
  { agency: 'FEMA', dataset: 'National Flood Hazard Layer (NFHL)', url: 'https://www.fema.gov/flood-maps/national-flood-hazard-layer' },
  { agency: 'USGS', dataset: '3DEP Elevation, NLCD Land Cover, NHD Hydrography', url: 'https://www.usgs.gov/' },
  { agency: 'EPA', dataset: 'Superfund, Brownfields, TRI, Water Quality (ATTAINS)', url: 'https://www.epa.gov/' },
  { agency: 'NOAA', dataset: 'Weather Stations, Tide Stations', url: 'https://www.noaa.gov/' },
  { agency: 'USDA/NRCS', dataset: 'SSURGO Soil Survey', url: 'https://www.nrcs.usda.gov/' },
  { agency: 'USFWS', dataset: 'NWI Wetlands, Critical Habitat', url: 'https://www.fws.gov/' },
  { agency: 'DOT', dataset: 'National Bridge Inventory', url: 'https://www.fhwa.dot.gov/bridge/nbi.cfm' },
  { agency: 'Census Bureau', dataset: 'TIGER Geographic Data', url: 'https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html' },
];

/**
 * Source metadata for every tool, keyed by tool name.
 */
export const toolSources = {
  // ── Spatial Queries ──
  query_address: MULTI_SOURCE,
  identify_features_at_point: MULTI_SOURCE,
  get_environmental_data_for_area: MULTI_SOURCE,
  get_environmental_data_near_point: MULTI_SOURCE,
  get_environmental_summary: MULTI_SOURCE,
  get_environmental_data_in_bbox: MULTI_SOURCE,

  // ── Data Layers ──
  list_data_layers: [{ agency: 'GeoTap', dataset: 'Layer Catalog (37 federal sources)', url: 'https://geotapdata.com' }],
  get_layer_details: [{ agency: 'GeoTap', dataset: 'Layer Catalog', url: 'https://geotapdata.com' }],
  get_layer_features: MULTI_SOURCE,

  // ── Rainfall & Precipitation ──
  get_rainfall_data: src(AGENCIES.NOAA, 'atlas14'),
  get_idf_curves: src(AGENCIES.NOAA, 'atlas14'),
  generate_hyetograph: src(AGENCIES.NOAA, 'atlas14'),
  export_hyetograph: src(AGENCIES.NOAA, 'atlas14'),
  list_rainfall_distributions: src(AGENCIES.USDA, 'tr55'),
  get_rainfall_distribution: [...src(AGENCIES.NOAA, 'atlas14'), ...src(AGENCIES.USDA, 'tr55')],
  get_climate_scenarios: src(AGENCIES.NOAA, 'cmip6'),
  get_climate_change_factors: [...src(AGENCIES.NOAA, 'atlas14'), ...src(AGENCIES.NOAA, 'cmip6')],
  get_climate_change_rainfall_projection: [...src(AGENCIES.NOAA, 'atlas14'), ...src(AGENCIES.NOAA, 'cmip6')],
  get_rainfall_uncertainty_bounds: src(AGENCIES.NOAA, 'atlas14'),
  generate_uncertainty_envelope: src(AGENCIES.NOAA, 'atlas14'),
  run_rainfall_sensitivity_analysis: src(AGENCIES.NOAA, 'atlas14'),
  get_design_approaches: src(AGENCIES.NOAA, 'atlas14'),
  check_rainfall_service_status: src(AGENCIES.NOAA, 'atlas14'),

  // ── Watershed & Hydrology ──
  delineate_watershed: src(AGENCIES.USGS, 'streamstats'),
  get_watershed_characteristics: src(AGENCIES.USGS, 'streamstats'),
  get_flow_statistics: src(AGENCIES.USGS, 'streamstats'),
  get_flowlines: src(AGENCIES.USGS, 'nhd'),
  get_watershed_water_quality: [...src(AGENCIES.USGS, 'nhd'), ...src(AGENCIES.EPA, 'attains')],

  // ── Hydrology Toolkit ──
  analyze_hydrology: [...src(AGENCIES.NOAA, 'atlas14'), ...src(AGENCIES.USDA, 'ssurgo'), ...src(AGENCIES.USDA, 'tr55')],
  get_hydrology_distributions: src(AGENCIES.USDA, 'tr55'),
  get_hydrology_distribution_for_location: [...src(AGENCIES.NOAA, 'atlas14'), ...src(AGENCIES.USDA, 'tr55')],

  // ── Curve Number ──
  lookup_curve_number: [...src(AGENCIES.USDA, 'tr55'), ...src(AGENCIES.USDA, 'ssurgo')],
  get_curve_number_tables: src(AGENCIES.USDA, 'tr55'),
  analyze_curve_numbers: [
    ...src(AGENCIES.USDA, 'ssurgo'),
    { agency: 'USGS', dataset: 'National Land Cover Database (NLCD)', url: 'https://www.mrlc.gov/' },
    { agency: 'USFWS', dataset: 'National Wetlands Inventory (NWI)', url: 'https://www.fws.gov/program/national-wetlands-inventory' },
  ],

  // ── Water Quality ──
  get_water_quality: [...src(AGENCIES.EPA, 'attains'), ...src(AGENCIES.USGS, 'nhd')],
  get_water_impairments: src(AGENCIES.EPA, 'attains'),
  get_watershed_for_point: src(AGENCIES.USGS, 'nhd'),

  // ── Waterway Permits ──
  find_water_features: [...src(AGENCIES.USGS, 'nhd'), ...src(AGENCIES.USFWS, 'nwi'), ...src(AGENCIES.FEMA, 'nfhl')],
  analyze_permit_requirements: [
    ...src(AGENCIES.USGS, 'nhd'),
    ...src(AGENCIES.USFWS, 'nwi'),
    ...src(AGENCIES.FEMA, 'nfhl'),
    { agency: 'USACE', dataset: 'Section 404 Permit Program', url: 'https://www.usace.army.mil/Missions/Civil-Works/Regulatory-Program-and-Permits/Obtain-a-Permit/' },
  ],

  // ── Elevation & Terrain ──
  get_elevation_stats: src(AGENCIES.USGS, 'dep3'),
  get_contour_lines: src(AGENCIES.USGS, 'dep3'),
  get_contour_interval_options: src(AGENCIES.USGS, 'dep3'),
  export_dem: src(AGENCIES.USGS, 'dep3'),
  export_contours: src(AGENCIES.USGS, 'dep3'),
  check_dem_availability: src(AGENCIES.USGS, 'dep3'),
  get_dem_resolution_options: src(AGENCIES.USGS, 'dep3'),

  // ── Land Use ──
  export_land_use: src(AGENCIES.USGS, 'nlcd'),

  // ── Monitoring Stations ──
  find_monitoring_stations: [...src(AGENCIES.USGS, 'nwis'), { agency: 'NOAA', dataset: 'Tide Stations, Weather Stations', url: 'https://tidesandcurrents.noaa.gov/' }],
  search_stations: [...src(AGENCIES.USGS, 'nwis'), { agency: 'NOAA', dataset: 'Tide Stations, Weather Stations', url: 'https://tidesandcurrents.noaa.gov/' }],
  get_station_types: [{ agency: 'GeoTap', dataset: 'Station Type Configuration', url: 'https://geotapdata.com' }],

  // ── Gage Intelligence: Gauged ──
  get_flood_frequency_analysis: [...src(AGENCIES.USGS, 'nwis'), { agency: 'USGS', dataset: 'Bulletin 17C Guidelines', url: 'https://pubs.usgs.gov/tm/04/b05/tm4b5.pdf' }],
  get_flow_duration_curve: src(AGENCIES.USGS, 'nwis'),
  get_low_flow_statistics: src(AGENCIES.USGS, 'nwis'),
  get_storm_events: src(AGENCIES.USGS, 'nwis'),
  get_storm_event_detail: src(AGENCIES.USGS, 'nwis'),
  export_storm_event_for_modeling: src(AGENCIES.USGS, 'nwis'),
  get_gage_summary: src(AGENCIES.USGS, 'nwis'),
  get_published_gage_statistics: [...src(AGENCIES.USGS, 'nwis'), ...src(AGENCIES.USGS, 'gagestats')],
  compare_computed_vs_published_stats: [...src(AGENCIES.USGS, 'nwis'), ...src(AGENCIES.USGS, 'gagestats')],

  // ── Gage Intelligence: Ungaged ──
  estimate_ungaged_flood_frequency: src(AGENCIES.USGS, 'nss'),
  estimate_all_ungaged_statistics: src(AGENCIES.USGS, 'nss'),
  get_ungaged_nss_regions: src(AGENCIES.USGS, 'nss'),
  get_ungaged_required_parameters: src(AGENCIES.USGS, 'nss'),

  // ── Watershed Similarity ──
  find_similar_watersheds: [...src(AGENCIES.USGS, 'nwis'), ...src(AGENCIES.USGS, 'streamstats')],
  find_similar_watersheds_with_stats: [...src(AGENCIES.USGS, 'nwis'), ...src(AGENCIES.USGS, 'gagestats')],
  recommend_index_gage: [...src(AGENCIES.USGS, 'nwis'), ...src(AGENCIES.USGS, 'gagestats')],
  transfer_flood_statistics: [...src(AGENCIES.USGS, 'nwis'), ...src(AGENCIES.USGS, 'gagestats')],

  // ── Site Analysis & Reports ──
  generate_site_analysis: MULTI_SOURCE,
  get_site_analysis_status: MULTI_SOURCE,
  generate_constraints_report: MULTI_SOURCE,
  get_constraints_report_status: MULTI_SOURCE,
  get_constraints_config: [{ agency: 'GeoTap', dataset: 'Constraints Configuration', url: 'https://geotapdata.com' }],
  generate_developability_report: MULTI_SOURCE,
  get_developability_config: [{ agency: 'GeoTap', dataset: 'Developability Configuration', url: 'https://geotapdata.com' }],

  // ── Export ──
  get_export_options: [{ agency: 'GeoTap', dataset: 'Export Configuration', url: 'https://geotapdata.com' }],
  export_data: MULTI_SOURCE,
  get_export_status: [{ agency: 'GeoTap', dataset: 'Export Job Status', url: 'https://geotapdata.com' }],

  // ── Utilities ──
  geocode_address: [
    { agency: 'Census Bureau', dataset: 'Census Geocoder', url: 'https://geocoding.geo.census.gov/' },
    { agency: 'OpenStreetMap', dataset: 'Photon / Nominatim Geocoder', url: 'https://photon.komoot.io/' },
  ],
  check_api_status: [{ agency: 'GeoTap', dataset: 'API Health Check', url: 'https://geotapdata.com' }],
  check_specific_api_status: [{ agency: 'GeoTap', dataset: 'API Health Check', url: 'https://geotapdata.com' }],
  get_firm_panels: src(AGENCIES.FEMA, 'nfhl'),
  get_huc_watersheds: src(AGENCIES.USGS, 'wbd'),
  get_huc_watershed_by_code: src(AGENCIES.USGS, 'wbd'),
  export_satellite_imagery: [...src(AGENCIES.USDA, 'naip'), { agency: 'USGS', dataset: 'Aerial Photography', url: 'https://www.usgs.gov/programs/national-geospatial-program/national-map' }],
  get_satellite_resolution_options: [...src(AGENCIES.USDA, 'naip')],

  // ── Meta Tools ──
  discover_tools: [{ agency: 'GeoTap', dataset: 'Tool Discovery', url: 'https://geotapdata.com' }],
  get_llms_txt: [{ agency: 'GeoTap', dataset: 'API Documentation', url: 'https://geotapdata.com/llms.txt' }],
};
