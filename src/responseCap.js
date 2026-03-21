/**
 * Response Size Capping & Smart Pagination
 *
 * Prevents oversized responses from blowing LLM context windows.
 * For spatial/feature responses, caps features and returns summaries.
 * For all responses, enforces a max character limit.
 */

const MAX_FEATURES = 50;
const MAX_RESPONSE_CHARS = 100_000; // ~25K tokens

/**
 * Tools that return feature collections and can be very large.
 * These get smart feature capping with layer summaries.
 */
const FEATURE_HEAVY_TOOLS = new Set([
  'get_environmental_data_for_area',
  'get_environmental_data_near_point',
  'get_environmental_data_in_bbox',
  'get_layer_features',
  'get_flowlines',
  'find_water_features',
  'get_huc_watersheds',
  'find_monitoring_stations',
]);

/**
 * Cap response size for LLM consumption.
 * Returns { data, wasCapped, capInfo } where capInfo describes what was trimmed.
 */
export function capResponse(toolName, result) {
  if (!result || typeof result !== 'object') {
    return { data: result, wasCapped: false };
  }

  let data = result;
  let wasCapped = false;
  let capInfo = null;

  // Smart feature capping for spatial tools
  if (FEATURE_HEAVY_TOOLS.has(toolName)) {
    const capped = capFeatures(data);
    if (capped.wasCapped) {
      data = capped.data;
      wasCapped = true;
      capInfo = capped.capInfo;
    }
  }

  // Final size check — truncate if still too large
  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_RESPONSE_CHARS) {
    wasCapped = true;
    const truncatedData = truncateToSize(data, MAX_RESPONSE_CHARS);
    capInfo = {
      ...(capInfo || {}),
      truncated: true,
      originalSizeKB: Math.round(serialized.length / 1024),
      maxSizeKB: Math.round(MAX_RESPONSE_CHARS / 1024),
      hint: 'Response was truncated to fit context window. Use more specific layer filters or geometry="none" to get smaller responses.'
    };
    data = truncatedData;
  }

  return { data, wasCapped, capInfo };
}

/**
 * Cap features in spatial query results.
 * Handles both { layers: { ... } } and { features: [...] } formats.
 */
function capFeatures(data) {
  // Format 1: Layered response { layers: { flood_zones: { features: [...] }, ... } }
  if (data.layers && typeof data.layers === 'object') {
    let totalOriginal = 0;
    let totalCapped = 0;
    const layerSummary = {};
    const cappedLayers = {};

    for (const [layerName, layerData] of Object.entries(data.layers)) {
      if (layerData?.features && Array.isArray(layerData.features)) {
        const count = layerData.features.length;
        totalOriginal += count;
        const cap = Math.min(count, MAX_FEATURES);
        totalCapped += cap;

        layerSummary[layerName] = {
          totalFeatures: count,
          returned: cap,
          wasCapped: count > MAX_FEATURES
        };

        cappedLayers[layerName] = {
          ...layerData,
          features: layerData.features.slice(0, MAX_FEATURES),
        };

        if (count > MAX_FEATURES) {
          cappedLayers[layerName]._featureCap = {
            showing: cap,
            total: count,
            hint: `Only showing first ${cap} of ${count} features. Use more specific filters to narrow results.`
          };
        }
      } else {
        cappedLayers[layerName] = layerData;
      }
    }

    if (totalOriginal > totalCapped) {
      return {
        data: {
          ...data,
          layers: cappedLayers,
          _pagination: {
            totalFeatures: totalOriginal,
            returnedFeatures: totalCapped,
            maxFeaturesPerLayer: MAX_FEATURES,
            layerSummary,
            hint: `Response capped at ${MAX_FEATURES} features per layer. ${totalOriginal - totalCapped} features omitted. Use layer filters or geometry="none" for full results.`
          }
        },
        wasCapped: true,
        capInfo: {
          totalFeatures: totalOriginal,
          returnedFeatures: totalCapped,
          layerSummary
        }
      };
    }

    return { data, wasCapped: false };
  }

  // Format 2: Direct feature collection { features: [...] } or { type: 'FeatureCollection', features: [...] }
  if (data.features && Array.isArray(data.features) && data.features.length > MAX_FEATURES) {
    const total = data.features.length;
    return {
      data: {
        ...data,
        features: data.features.slice(0, MAX_FEATURES),
        _pagination: {
          totalFeatures: total,
          returnedFeatures: MAX_FEATURES,
          hint: `Only showing first ${MAX_FEATURES} of ${total} features. Use tighter geographic bounds or layer filters to narrow results.`
        }
      },
      wasCapped: true,
      capInfo: {
        totalFeatures: total,
        returnedFeatures: MAX_FEATURES
      }
    };
  }

  return { data, wasCapped: false };
}

/**
 * Truncate a response object to fit within a character limit.
 * Strips geometry first, then truncates arrays.
 */
function truncateToSize(data, maxChars) {
  // First pass: strip geometry from features if present
  const stripped = stripGeometry(data);
  const strippedStr = JSON.stringify(stripped);
  if (strippedStr.length <= maxChars) {
    return { ...stripped, _note: 'Geometry stripped to reduce response size. Use geometry="full" if coordinates are needed.' };
  }

  // Second pass: truncate arrays
  return truncateArrays(stripped, maxChars);
}

function stripGeometry(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripGeometry);

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'geometry' && value?.type && value?.coordinates) {
      result[key] = { type: value.type, _stripped: 'Coordinates removed to reduce size' };
    } else if (key === 'features' && Array.isArray(value)) {
      result[key] = value.map(f => {
        if (f?.geometry?.coordinates) {
          return { ...f, geometry: { type: f.geometry.type, _stripped: 'Coordinates removed' } };
        }
        return f;
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = stripGeometry(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function truncateArrays(obj, maxChars) {
  const str = JSON.stringify(obj);
  if (str.length <= maxChars) return obj;

  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj) && obj.length > 10) {
    return [...obj.slice(0, 10), { _truncated: `${obj.length - 10} more items omitted` }];
  }

  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value) && value.length > 10) {
      result[key] = [...value.slice(0, 10), { _truncated: `${value.length - 10} more items omitted` }];
    } else if (typeof value === 'object' && value !== null) {
      result[key] = truncateArrays(value, maxChars);
    } else {
      result[key] = value;
    }
  }
  return result;
}
