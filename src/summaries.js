/**
 * Natural Language Summaries for MCP Tool Responses
 *
 * Generates plain-English _summary fields for every tool response,
 * so LLMs get pre-digested context alongside structured data.
 */

/**
 * Generate a natural language summary for a tool response.
 * Returns a string summary or null if no summary can be generated.
 */
export function generateSummary(toolName, params, result) {
  if (!result || typeof result !== 'object') return null;

  try {
    const generator = SUMMARY_GENERATORS[toolName] || getCategorySummary(toolName);
    if (generator) return generator(params, result);
    return defaultSummary(toolName, result);
  } catch {
    return null;
  }
}

// ── Per-tool summary generators ─────────────────────────────────────

const SUMMARY_GENERATORS = {
  query_address(params, result) {
    const parts = [`Environmental data for "${params.address}".`];
    if (result.coordinates) {
      parts.push(`Location: ${result.coordinates.lat?.toFixed(4)}, ${result.coordinates.lng?.toFixed(4)}.`);
    }
    if (result.layers) {
      const layerSummaries = [];
      for (const [name, data] of Object.entries(result.layers)) {
        const count = data?.features?.length || 0;
        if (count > 0) layerSummaries.push(`${count} ${formatLayerName(name)}`);
      }
      if (layerSummaries.length) {
        parts.push(`Found: ${layerSummaries.join(', ')}.`);
      } else {
        parts.push('No environmental features found at this location.');
      }
    }
    // Pull out key interpretations
    const interps = extractInterpretations(result);
    if (interps.length) parts.push(interps.join(' '));
    return parts.join(' ');
  },

  identify_features_at_point(params, result) {
    const parts = [`Environmental features at (${params.lat}, ${params.lng}).`];
    if (result.layers) {
      const layerSummaries = [];
      for (const [name, data] of Object.entries(result.layers)) {
        const count = data?.features?.length || 0;
        if (count > 0) layerSummaries.push(`${count} ${formatLayerName(name)}`);
      }
      if (layerSummaries.length) parts.push(`Found: ${layerSummaries.join(', ')}.`);
    }
    const interps = extractInterpretations(result);
    if (interps.length) parts.push(interps.join(' '));
    return parts.join(' ');
  },

  get_environmental_data_for_area(params, result) {
    return summarizeSpatialResult('polygon area', result);
  },

  get_environmental_data_near_point(params, result) {
    const radius = params.radius || 1;
    return summarizeSpatialResult(`${radius}km radius of (${params.lat}, ${params.lng})`, result);
  },

  get_environmental_data_in_bbox(params, result) {
    return summarizeSpatialResult(`bounding box ${params.bbox}`, result);
  },

  get_environmental_summary(params, result) {
    if (result.summary) {
      const counts = [];
      for (const [layer, data] of Object.entries(result.summary)) {
        const count = data?.count || data?.featureCount || 0;
        if (count > 0) counts.push(`${count} ${formatLayerName(layer)}`);
      }
      if (counts.length) return `Environmental summary: ${counts.join(', ')} found in the area.`;
    }
    return 'Environmental feature count summary for the specified area.';
  },

  get_rainfall_data(params, result) {
    const parts = [`NOAA Atlas 14 rainfall data for (${params.lat}, ${params.lon || params.lng}).`];
    // Try to extract key values
    if (result.depths) {
      const d = result.depths;
      // Look for 100-year 24-hour
      const yr100 = d['100'] || d['100yr'];
      if (yr100) {
        const hr24 = yr100['24hr'] || yr100['24'] || yr100['1440'];
        if (hr24 !== undefined) {
          const units = params.units === 'metric' ? 'mm' : 'inches';
          parts.push(`100-year 24-hour rainfall: ${hr24} ${units}.`);
        }
      }
      // 10-year
      const yr10 = d['10'] || d['10yr'];
      if (yr10) {
        const hr24 = yr10['24hr'] || yr10['24'] || yr10['1440'];
        if (hr24 !== undefined) {
          const units = params.units === 'metric' ? 'mm' : 'inches';
          parts.push(`10-year 24-hour: ${hr24} ${units}.`);
        }
      }
    }
    if (result.location) {
      parts.push(`Station: ${result.location.name || result.location.station || 'N/A'}.`);
    }
    return parts.join(' ');
  },

  get_idf_curves(params, result) {
    const rps = params.returnPeriods || '2,5,10,25,50,100';
    return `IDF curve data for (${params.lat}, ${params.lon || params.lng}) covering return periods: ${rps} years. Data includes intensity vs. duration for each return period, suitable for charting IDF curves.`;
  },

  generate_hyetograph(params, result) {
    const totalDepth = result.totalDepth || result.total_depth;
    const steps = result.hyetograph?.length || result.data?.length || 'N/A';
    return `${params.returnPeriod} ${params.duration}-hour design storm hyetograph using ${params.distribution} distribution. Total depth: ${totalDepth || 'see data'}. Time steps: ${steps} at ${params.timeInterval}-minute intervals.`;
  },

  delineate_watershed(params, result) {
    const area = result.characteristics?.drainageArea || result.drainageArea || result.area;
    const parts = [`Watershed delineated for pour point (${params.lat}, ${params.lng}).`];
    if (area) parts.push(`Drainage area: ${area} sq mi.`);
    if (result.characteristics) {
      const c = result.characteristics;
      if (c.meanBasinSlope) parts.push(`Mean slope: ${c.meanBasinSlope}%.`);
      if (c.meanAnnualPrecip) parts.push(`Mean annual precip: ${c.meanAnnualPrecip} inches.`);
    }
    return parts.join(' ');
  },

  get_flow_statistics(params, result) {
    const parts = [`Flow statistics for (${params.lat}, ${params.lng}).`];
    if (result.peakFlows || result.flowStatistics) {
      const flows = result.peakFlows || result.flowStatistics;
      if (flows['100'] || flows['Q100']) {
        parts.push(`100-year peak flow: ${flows['100'] || flows['Q100']} cfs.`);
      }
      if (flows['10'] || flows['Q10']) {
        parts.push(`10-year: ${flows['10'] || flows['Q10']} cfs.`);
      }
    }
    return parts.join(' ');
  },

  get_water_quality(params, result) {
    const parts = ['Water quality assessment.'];
    if (result.receivingWater) {
      parts.push(`Receiving water: ${result.receivingWater.name || 'unnamed'}.`);
    }
    if (result.impairments?.length) {
      parts.push(`${result.impairments.length} impairment(s) found: ${result.impairments.map(i => i.pollutant || i.cause || i.name).filter(Boolean).slice(0, 5).join(', ')}.`);
    } else {
      parts.push('No impairments found in the area.');
    }
    return parts.join(' ');
  },

  analyze_curve_numbers(params, result) {
    const parts = ['Curve number analysis.'];
    if (result.catchments?.length) {
      for (const c of result.catchments.slice(0, 3)) {
        const cn = c.compositeCN || c.curveNumber;
        const name = c.name || c.id;
        if (cn) parts.push(`${name ? name + ': ' : ''}Composite CN = ${cn}.`);
        if (c.dominantHSG) parts.push(`Dominant HSG: ${c.dominantHSG}.`);
      }
    }
    return parts.join(' ');
  },

  generate_site_analysis(params, result) {
    const parts = [`Site analysis report${params.projectName ? ` for "${params.projectName}"` : ''}.`];
    if (result.jobId) parts.push(`Job ID: ${result.jobId}. Poll get_site_analysis_status to check progress.`);
    if (result.status === 'complete' && result.report) {
      const r = result.report;
      if (r.developabilityScore !== undefined) parts.push(`Developability score: ${r.developabilityScore}/100.`);
    }
    return parts.join(' ');
  },

  generate_constraints_report(params, result) {
    const parts = [`Constraints report${params.projectName ? ` for "${params.projectName}"` : ''}.`];
    if (result.jobId) parts.push(`Job ID: ${result.jobId}. Poll get_constraints_report_status to check progress.`);
    return parts.join(' ');
  },

  generate_developability_report(params, result) {
    const parts = ['Developability assessment.'];
    if (result.jobId) parts.push(`Job ID: ${result.jobId}.`);
    if (result.score !== undefined) parts.push(`Score: ${result.score}/100.`);
    return parts.join(' ');
  },

  geocode_address(params, result) {
    if (result.lat && result.lng) {
      return `"${params.address}" geocoded to (${result.lat}, ${result.lng}).${result.formattedAddress ? ` Matched: ${result.formattedAddress}` : ''}`;
    }
    if (result.results?.length) {
      const r = result.results[0];
      return `"${params.address}" geocoded to (${r.lat}, ${r.lng}).${r.formattedAddress ? ` Matched: ${r.formattedAddress}` : ''}`;
    }
    return `Geocoding result for "${params.address}".`;
  },

  list_data_layers(params, result) {
    const count = result.layers?.length || result.length || 'multiple';
    return `${count} data layers available from federal agencies including FEMA, USGS, EPA, NOAA, USDA, USFWS, DOT, and Census Bureau.`;
  },

  check_api_status(params, result) {
    const up = [];
    const down = [];
    if (result.services) {
      for (const [name, status] of Object.entries(result.services)) {
        if (status.healthy || status.status === 'ok' || status === 'ok') up.push(name);
        else down.push(name);
      }
    }
    if (up.length || down.length) {
      return `API status: ${up.length} services healthy${down.length ? `, ${down.length} degraded (${down.join(', ')})` : ''}. All systems operational.`;
    }
    return 'GeoTap API status check complete.';
  },

  find_similar_watersheds(params, result) {
    const count = result.similarWatersheds?.length || result.results?.length || 0;
    return `Found ${count} similar gauged watershed(s) near (${params.lat}, ${params.lng}). These can be used as analogs for flow estimation at ungaged sites.`;
  },

  get_flood_frequency_analysis(params, result) {
    const parts = [`Bulletin 17C flood frequency analysis for gage ${params.siteId}.`];
    if (result.peakFlows) {
      const q100 = result.peakFlows['100'] || result.peakFlows['Q100'];
      if (q100) parts.push(`100-year peak: ${q100} cfs.`);
    }
    if (result.yearsOfRecord) parts.push(`${result.yearsOfRecord} years of record.`);
    return parts.join(' ');
  },

  get_gage_summary(params, result) {
    const parts = [`Gage summary for ${params.siteId}.`];
    if (result.siteName) parts.push(`Name: ${result.siteName}.`);
    if (result.drainageArea) parts.push(`Drainage area: ${result.drainageArea} sq mi.`);
    if (result.periodOfRecord) parts.push(`Period of record: ${result.periodOfRecord}.`);
    return parts.join(' ');
  },

  export_data(params, result) {
    if (result.jobId) return `Export job started (ID: ${result.jobId}). Format: ${params.format}. Poll get_export_status to check when ready.`;
    if (result.downloadUrl) return `Export complete. Format: ${params.format}. Download: ${result.downloadUrl}`;
    return `Data export initiated in ${params.format} format.`;
  }
};

// ── Category-level fallback generators ──────────────────────────────

const CATEGORY_PATTERNS = {
  rainfall: /^(get_rainfall|get_idf|generate_hyetograph|export_hyetograph|list_rainfall|get_climate|get_design_approaches|check_rainfall|run_rainfall|generate_uncertainty|get_rainfall_uncertainty)/,
  watershed: /^(delineate_watershed|get_watershed|get_flow_statistics|get_flowlines)/,
  hydrology: /^(analyze_hydrology|get_hydrology)/,
  curveNumber: /^(lookup_curve_number|get_curve_number|analyze_curve_numbers)/,
  waterQuality: /^(get_water_quality|get_water_impairments|get_watershed_for_point)/,
  elevation: /^(get_elevation|get_contour|export_dem|export_contours|check_dem|get_dem)/,
  gage: /^(get_flood_frequency|get_flow_duration|get_low_flow|get_storm_event|export_storm|get_gage|get_published|compare_computed)/,
  ungaged: /^(estimate_ungaged|estimate_all_ungaged|get_ungaged)/,
  similarity: /^(find_similar|recommend_index|transfer_flood)/,
  stations: /^(find_monitoring|search_stations|get_station_types)/,
  export: /^(get_export|export_data|export_land|export_satellite)/,
  siteAnalysis: /^(generate_site|get_site_analysis|generate_constraints|get_constraints|generate_developability|get_developability)/,
  permits: /^(find_water_features|analyze_permit)/,
};

function getCategorySummary(toolName) {
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(toolName)) return CATEGORY_FALLBACKS[category] || null;
  }
  return null;
}

const CATEGORY_FALLBACKS = {
  rainfall: (params, result) => {
    const loc = params.lat ? `(${params.lat}, ${params.lon || params.lng})` : 'the specified location';
    return `Rainfall/precipitation data for ${loc}. See structured data for full details.`;
  },
  watershed: (params, result) => {
    const loc = params.lat ? `(${params.lat}, ${params.lng})` : params.bbox || 'the specified area';
    return `Watershed data for ${loc}. See structured data for details.`;
  },
  elevation: (params, result) => {
    return `Elevation/terrain data from USGS 3DEP. See structured data for details.`;
  },
  gage: (params, result) => {
    return `Stream gage analysis for station ${params.siteId || 'unknown'}. See structured data for details.`;
  },
  ungaged: (params, result) => {
    return `Ungaged flow estimation for ${params.state || 'the specified state'}. See structured data for details.`;
  },
  stations: (params, result) => {
    const count = result.stations?.length || result.length || 'multiple';
    return `Found ${count} monitoring station(s). See structured data for details.`;
  },
  permits: (params, result) => {
    return `Waterway permit analysis. See structured data for regulatory requirements.`;
  },
  siteAnalysis: (params, result) => {
    if (result.jobId) return `Report job started (ID: ${result.jobId}). Poll the status endpoint to check progress.`;
    return `Site analysis data. See structured response for details.`;
  },
  export: (params, result) => {
    if (result.jobId) return `Export job started (ID: ${result.jobId}). Poll get_export_status to check progress.`;
    if (result.format === 'binary' || result.downloadUrl) return `Export ready for download. See downloadUrl in response.`;
    return `Data export result. See structured data for details.`;
  }
};

// ── Helpers ─────────────────────────────────────────────────────────

function defaultSummary(toolName, result) {
  // Generic fallback - describe what was returned
  const keys = Object.keys(result).filter(k => !k.startsWith('_'));
  if (keys.length === 0) return null;

  if (result.success === false || result.error) {
    return `Request failed: ${result.error || 'unknown error'}. Check parameters and try again.`;
  }

  return `Response contains: ${keys.slice(0, 8).join(', ')}${keys.length > 8 ? ` and ${keys.length - 8} more fields` : ''}.`;
}

function summarizeSpatialResult(locationDesc, result) {
  const parts = [`Environmental data within ${locationDesc}.`];

  if (result.layers) {
    const layerCounts = [];
    let totalFeatures = 0;
    for (const [name, data] of Object.entries(result.layers)) {
      const count = data?.features?.length || data?.featureCount || 0;
      totalFeatures += count;
      if (count > 0) layerCounts.push(`${count} ${formatLayerName(name)}`);
    }
    if (layerCounts.length) {
      parts.push(`${totalFeatures} total features across ${layerCounts.length} layers: ${layerCounts.slice(0, 6).join(', ')}${layerCounts.length > 6 ? '...' : ''}.`);
    }
  }

  if (result._pagination) {
    parts.push(`Note: Response capped at ${result._pagination.returnedFeatures} of ${result._pagination.totalFeatures} features.`);
  }

  const interps = extractInterpretations(result);
  if (interps.length) parts.push(interps.join(' '));

  return parts.join(' ');
}

function extractInterpretations(result) {
  const interps = [];
  if (!result || typeof result !== 'object') return interps;

  // Look for _interpretation fields in layers
  if (result.layers) {
    for (const [, layerData] of Object.entries(result.layers)) {
      if (layerData?._interpretation) {
        interps.push(layerData._interpretation);
      }
      if (layerData?.features) {
        for (const f of layerData.features.slice(0, 3)) {
          if (f?.properties?._interpretation) {
            interps.push(f.properties._interpretation);
          }
        }
      }
    }
  }

  // Top-level interpretation
  if (result._interpretation) interps.push(result._interpretation);

  return interps.slice(0, 5); // Cap at 5 interpretations
}

function formatLayerName(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
