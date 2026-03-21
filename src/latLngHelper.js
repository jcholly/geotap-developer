/**
 * Lat/Lng Convenience Helper
 *
 * Automatically converts flat lat/lng parameters to GeoJSON geometry
 * for POST endpoints that require GeoJSON input. This eliminates the
 * #1 error pattern where LLMs get GeoJSON wrong (especially lng/lat order).
 */

/**
 * Tools that accept geometry/polygon/location as GeoJSON but could
 * accept lat/lng instead for point-based queries.
 */
const GEOMETRY_TOOLS = {
  // Tools that accept 'polygon' parameter — convert lat/lng to small bounding box
  get_environmental_data_for_area: { param: 'polygon', type: 'bbox' },
  get_environmental_summary: { param: 'polygon', type: 'bbox' },
  find_water_features: { param: 'polygon', type: 'bbox' },
  export_dem: { param: 'polygon', type: 'bbox' },
  export_contours: { param: 'polygon', type: 'bbox' },
  export_land_use: { param: 'polygon', type: 'bbox' },
  export_satellite_imagery: { param: 'polygon', type: 'bbox' },

  // Tools that accept 'geometry' parameter — convert to Point
  generate_site_analysis: { param: 'geometry', type: 'point' },
  generate_constraints_report: { param: 'geometry', type: 'point' },
  generate_developability_report: { param: 'geometry', type: 'point' },
  export_data: { param: 'geometry', type: 'point' },

  // Tools that accept 'location' parameter — convert to Point
  get_water_quality: { param: 'location', type: 'point' },

  // Tools that accept 'catchments' parameter — convert to small polygon FeatureCollection
  analyze_hydrology: { param: 'catchments', type: 'featureCollection' },
  analyze_curve_numbers: { param: 'catchments', type: 'featureCollection' },
};

/** Default radius in km for converting a point to a small bounding box */
const DEFAULT_RADIUS_KM = 0.5;

/**
 * If the tool accepts GeoJSON and the user provided lat/lng instead,
 * convert to the appropriate GeoJSON structure.
 *
 * Returns the (possibly modified) params object.
 */
export function convertLatLng(toolName, params) {
  if (!params) return params;

  const config = GEOMETRY_TOOLS[toolName];
  if (!config) return params;

  // Only convert if lat/lng are present AND the geometry param is missing
  const hasLatLng = params.lat !== undefined && (params.lng !== undefined || params.lon !== undefined);
  const hasGeometry = params[config.param] !== undefined;

  if (!hasLatLng || hasGeometry) return params;

  const lat = Number(params.lat);
  const lng = Number(params.lng ?? params.lon);

  if (isNaN(lat) || isNaN(lng)) return params;

  const newParams = { ...params };
  delete newParams.lat;
  delete newParams.lng;
  delete newParams.lon;

  const radiusKm = params.radius || DEFAULT_RADIUS_KM;

  switch (config.type) {
    case 'point':
      newParams[config.param] = {
        type: 'Point',
        coordinates: [lng, lat]
      };
      break;

    case 'bbox': {
      const bbox = createBBox(lat, lng, radiusKm);
      newParams[config.param] = {
        type: 'Polygon',
        coordinates: [bbox]
      };
      break;
    }

    case 'featureCollection': {
      const bbox = createBBox(lat, lng, radiusKm);
      newParams[config.param] = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Area of Interest' },
          geometry: {
            type: 'Polygon',
            coordinates: [bbox]
          }
        }]
      };
      break;
    }
  }

  // Add a note so the LLM knows what happened
  newParams._latLngConverted = {
    originalLat: lat,
    originalLng: lng,
    convertedTo: config.type,
    radiusKm: config.type !== 'point' ? radiusKm : undefined,
    note: `Converted lat/lng to ${config.type === 'point' ? 'GeoJSON Point' : `${radiusKm}km bounding box polygon`}. For custom areas, pass a GeoJSON ${config.param} directly.`
  };

  return newParams;
}

/**
 * Create a bounding box polygon from lat/lng and radius in km.
 * Returns coordinates array for a GeoJSON Polygon ring.
 */
function createBBox(lat, lng, radiusKm) {
  // Approximate degrees per km
  const latDeg = radiusKm / 111.32;
  const lngDeg = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));

  const south = lat - latDeg;
  const north = lat + latDeg;
  const west = lng - lngDeg;
  const east = lng + lngDeg;

  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south]  // close the ring
  ];
}
