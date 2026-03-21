/**
 * Tool Discovery Meta-Tool
 *
 * With 68+ tools, LLMs waste context loading all descriptions upfront.
 * This meta-tool lets the AI describe what it needs in natural language
 * and get back the 3-5 most relevant tools.
 */

import { tools } from './tools.js';

/**
 * Tool categories with keywords for matching.
 */
const TOOL_CATEGORIES = {
  'Getting Started': {
    keywords: ['start', 'begin', 'address', 'location', 'what is', 'tell me about', 'lookup', 'search address', 'find address'],
    tools: ['query_address', 'identify_features_at_point', 'geocode_address']
  },
  'Flood & FEMA': {
    keywords: ['flood', 'fema', 'firm', 'floodplain', 'flood zone', 'flood insurance', 'nfhl', 'base flood', 'special flood'],
    tools: ['query_address', 'get_firm_panels', 'get_environmental_data_for_area']
  },
  'Rainfall & Precipitation': {
    keywords: ['rain', 'rainfall', 'precipitation', 'storm', 'idf', 'hyetograph', 'atlas 14', 'design storm', 'intensity', 'duration', 'frequency', 'climate change', 'climate projection'],
    tools: ['get_rainfall_data', 'get_idf_curves', 'generate_hyetograph', 'get_rainfall_distribution', 'get_climate_change_rainfall_projection', 'get_rainfall_uncertainty_bounds', 'run_rainfall_sensitivity_analysis']
  },
  'Watershed & Hydrology': {
    keywords: ['watershed', 'drainage', 'basin', 'delineate', 'hydrology', 'runoff', 'peak flow', 'streamstats', 'catchment', 'time of concentration'],
    tools: ['delineate_watershed', 'get_watershed_characteristics', 'get_flow_statistics', 'analyze_hydrology', 'get_flowlines']
  },
  'Curve Number & Soils': {
    keywords: ['curve number', 'cn', 'soil', 'hsg', 'hydrologic soil', 'runoff', 'scs', 'nrcs', 'ssurgo', 'infiltration', 'pervious', 'impervious'],
    tools: ['analyze_curve_numbers', 'lookup_curve_number', 'get_curve_number_tables']
  },
  'Water Quality': {
    keywords: ['water quality', 'impairment', 'impaired', 'pollution', 'pollutant', 'tmdl', '303d', 'attains', 'epa', 'clean water', 'npdes', 'discharge'],
    tools: ['get_water_quality', 'get_water_impairments', 'get_watershed_for_point', 'get_watershed_water_quality']
  },
  'Wetlands & Species': {
    keywords: ['wetland', 'nwi', 'endangered', 'species', 'habitat', 'critical habitat', 'protected', 'conservation', 'wildlife'],
    tools: ['query_address', 'identify_features_at_point', 'get_environmental_data_for_area']
  },
  'Elevation & Terrain': {
    keywords: ['elevation', 'dem', 'terrain', 'contour', 'topography', 'slope', 'lidar', '3dep', 'relief', 'grading'],
    tools: ['get_elevation_stats', 'get_contour_lines', 'export_dem', 'export_contours', 'check_dem_availability']
  },
  'Stream Gages': {
    keywords: ['gage', 'gauge', 'stream gage', 'streamflow', 'usgs gage', 'flood frequency', 'flow duration', 'low flow', 'storm event', 'bulletin 17', 'peak flow record', 'annual peak'],
    tools: ['get_gage_summary', 'get_flood_frequency_analysis', 'get_flow_duration_curve', 'get_low_flow_statistics', 'get_storm_events', 'get_published_gage_statistics']
  },
  'Ungaged Estimation': {
    keywords: ['ungaged', 'ungauged', 'no gage', 'regression', 'nss', 'regional equation', 'estimate flow', 'similar watershed'],
    tools: ['estimate_ungaged_flood_frequency', 'estimate_all_ungaged_statistics', 'find_similar_watersheds', 'recommend_index_gage', 'transfer_flood_statistics']
  },
  'Permits & Regulatory': {
    keywords: ['permit', 'regulatory', 'section 404', 'usace', 'army corps', 'waterway', 'crossing', 'construction near water', '401 certification'],
    tools: ['find_water_features', 'analyze_permit_requirements']
  },
  'Site Analysis & Reports': {
    keywords: ['site analysis', 'report', 'assessment', 'due diligence', 'developability', 'constraints', 'can i build', 'feasibility', 'environmental review'],
    tools: ['generate_site_analysis', 'generate_constraints_report', 'generate_developability_report']
  },
  'Monitoring Stations': {
    keywords: ['station', 'monitoring', 'weather station', 'tide', 'groundwater', 'well', 'camera', 'sensor'],
    tools: ['find_monitoring_stations', 'search_stations', 'get_station_types']
  },
  'Data Export': {
    keywords: ['export', 'download', 'shapefile', 'geojson', 'csv', 'kml', 'geopackage', 'geotiff', 'gis', 'cad'],
    tools: ['export_data', 'get_export_options', 'export_dem', 'export_contours', 'export_land_use', 'export_satellite_imagery']
  },
  'Land Use & Imagery': {
    keywords: ['land use', 'land cover', 'nlcd', 'satellite', 'imagery', 'aerial', 'naip', 'impervious surface', 'developed', 'forest'],
    tools: ['export_land_use', 'export_satellite_imagery', 'get_satellite_resolution_options']
  },
  'HUC Watersheds': {
    keywords: ['huc', 'hydrologic unit', 'watershed boundary', 'wbd', 'huc8', 'huc10', 'huc12', 'subwatershed'],
    tools: ['get_huc_watersheds', 'get_huc_watershed_by_code', 'get_watershed_for_point']
  },
  'API Status': {
    keywords: ['status', 'health', 'api', 'available', 'working', 'service', 'down', 'outage'],
    tools: ['check_api_status', 'check_specific_api_status', 'check_rainfall_service_status']
  }
};

/**
 * Find the most relevant tools for a natural language question.
 */
export function discoverTools(question, maxResults = 5) {
  const q = question.toLowerCase();
  const scores = {};

  // Score each category by keyword matches
  for (const [category, config] of Object.entries(TOOL_CATEGORIES)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (q.includes(keyword)) {
        score += keyword.split(' ').length; // Multi-word matches score higher
      }
    }
    if (score > 0) {
      for (const toolName of config.tools) {
        scores[toolName] = (scores[toolName] || 0) + score;
      }
    }
  }

  // Also score by tool description similarity
  for (const tool of tools) {
    const desc = tool.description.toLowerCase();
    const words = q.split(/\s+/).filter(w => w.length > 3);
    let descScore = 0;
    for (const word of words) {
      if (desc.includes(word)) descScore += 0.5;
    }
    if (descScore > 0) {
      scores[tool.name] = (scores[tool.name] || 0) + descScore;
    }
  }

  // Sort by score and return top N
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults);

  // Build result with tool details
  const toolMap = new Map(tools.map(t => [t.name, t]));
  const results = ranked.map(([name, score]) => {
    const tool = toolMap.get(name);
    if (!tool) return null;

    // Build parameter info
    const params = {};
    if (tool.parameters) {
      for (const [pName, pSchema] of Object.entries(tool.parameters)) {
        params[pName] = {
          type: pSchema._def?.typeName || 'unknown',
          required: !pSchema.isOptional?.(),
          description: pSchema._def?.description || pSchema.description || ''
        };
      }
    }

    return {
      name: tool.name,
      description: tool.description.split('.')[0] + '.', // First sentence only
      method: tool.method,
      parameters: params,
      relevanceScore: Math.round(score * 10) / 10
    };
  }).filter(Boolean);

  // Find matching categories
  const matchedCategories = [];
  for (const [category, config] of Object.entries(TOOL_CATEGORIES)) {
    let score = 0;
    for (const keyword of config.keywords) {
      if (q.includes(keyword)) score++;
    }
    if (score > 0) matchedCategories.push({ category, relevance: score });
  }
  matchedCategories.sort((a, b) => b.relevance - a.relevance);

  return {
    question,
    recommendedTools: results,
    matchedCategories: matchedCategories.slice(0, 3).map(c => c.category),
    allCategories: Object.keys(TOOL_CATEGORIES),
    hint: results.length > 0
      ? `Start with "${results[0].name}" — it's the best match for your question.`
      : 'No strong matches found. Try query_address for location-based questions, or list_data_layers to see available data.',
    totalToolsAvailable: tools.length
  };
}
