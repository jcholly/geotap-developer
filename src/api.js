const BASE_URL = process.env.GEOTAP_API_URL || 'https://geotapdata.com/api/v1';
const API_KEY = process.env.GEOTAP_API_KEY || '';

/**
 * Structured API Error with fix instructions for LLMs.
 */
export class StructuredApiError extends Error {
  constructor(details) {
    super(details.message);
    this.name = 'StructuredApiError';
    this.details = details;
  }
}

/**
 * Build a structured error with fix instructions and related tools.
 */
function buildStructuredError(status, errorText, endpoint, method, params) {
  const base = {
    error: true,
    status,
    message: `GeoTap API error (${status}): ${errorText}`,
    endpoint,
    method
  };

  // Parse common error patterns and provide actionable fixes
  const fixes = [];
  const relatedTools = [];

  if (status === 400) {
    if (/geometry|polygon|geojson/i.test(errorText)) {
      fixes.push('Provide a valid GeoJSON geometry object, or use lat/lng parameters instead (they will be auto-converted to GeoJSON).');
      fixes.push('Example: { "lat": 32.08, "lng": -81.09 } instead of a GeoJSON polygon.');
    }
    if (/missing|required/i.test(errorText)) {
      const missingParam = errorText.match(/(?:missing|required)[:\s]+(\w+)/i)?.[1];
      if (missingParam) {
        fixes.push(`Add the required parameter: "${missingParam}".`);
      }
    }
    if (/lat|lng|lon|coordinate/i.test(errorText)) {
      fixes.push('Ensure lat is between -90 and 90, lng is between -180 and 180. Note: coordinates must be within the United States.');
      relatedTools.push('geocode_address');
    }
    if (/layer/i.test(errorText)) {
      fixes.push('Use list_data_layers to see valid layer names. Layer names use underscores (e.g., flood_zones, wetlands).');
      relatedTools.push('list_data_layers');
    }
    if (/bbox|bounding/i.test(errorText)) {
      fixes.push('Bounding box format: "west,south,east,north" in WGS84 (e.g., "-81.1,32.0,-81.0,32.1"). West must be less than east, south less than north.');
    }
  }

  if (status === 401 || status === 403) {
    fixes.push('Set GEOTAP_API_KEY environment variable with a valid API key. Get one at https://geotapdata.com');
    relatedTools.push('check_api_status');
  }

  if (status === 404) {
    if (/gage|site|station/i.test(endpoint)) {
      fixes.push('Station/gage not found. Verify the site ID is a valid USGS station number (e.g., "08158000").');
      relatedTools.push('find_monitoring_stations', 'search_stations');
    }
    if (/job/i.test(endpoint)) {
      fixes.push('Job ID not found or expired. Submit a new request to start a fresh job.');
    }
  }

  if (status === 429) {
    fixes.push('Rate limit exceeded. Wait a moment and retry, or upgrade your API key tier at https://geotapdata.com');
  }

  if (status >= 500) {
    fixes.push('Server error — the upstream federal data source may be temporarily unavailable.');
    fixes.push('Try again in a few seconds, or check check_api_status to see which services are up.');
    relatedTools.push('check_api_status');
  }

  if (fixes.length === 0) {
    fixes.push('Check that all required parameters are provided and valid.');
    fixes.push('Use discover_tools to find the right tool for your question.');
    relatedTools.push('discover_tools');
  }

  return {
    ...base,
    fix: fixes,
    relatedTools: [...new Set(relatedTools)]
  };
}

/**
 * Call the GeoTap API.
 * Handles both GET (query params) and POST (JSON body) requests.
 *
 * For JSON responses: returns parsed JSON.
 * For binary/file responses (GeoTIFF, CSV, etc.): returns metadata
 * with a download URL instead of raw bytes, since MCP protocol
 * only supports text content.
 */
export async function callApi(endpoint, method, params) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'geotap-mcp-server/2.2.1'
  };

  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }

  // Substitute path parameters like {siteId} with values from params
  let resolvedEndpoint = endpoint;
  const remainingParams = { ...params };
  const pathParamRegex = /\{(\w+)\}/g;
  let match;
  while ((match = pathParamRegex.exec(endpoint)) !== null) {
    const paramName = match[1];
    if (remainingParams[paramName] !== undefined) {
      resolvedEndpoint = resolvedEndpoint.replace(`{${paramName}}`, encodeURIComponent(remainingParams[paramName]));
      delete remainingParams[paramName];
    }
  }

  let url = `${BASE_URL}${resolvedEndpoint}`;
  const fetchOptions = { method, headers };

  if (method === 'GET' && remainingParams && Object.keys(remainingParams).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(remainingParams)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    }
    url += `?${searchParams.toString()}`;
  } else if (method === 'POST' && remainingParams) {
    fetchOptions.body = JSON.stringify(remainingParams);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    const structured = buildStructuredError(response.status, errorText, endpoint, method, params);
    throw new StructuredApiError(structured);
  }

  // Check content type to handle binary vs JSON responses
  const contentType = response.headers.get('content-type') || '';

  // JSON response — parse and return directly
  if (contentType.includes('application/json')) {
    return response.json();
  }

  // CSV/text response — return as text data inline
  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    const text = await response.text();
    const disposition = response.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^";\s]+)"?/);
    return {
      success: true,
      format: contentType.includes('csv') ? 'csv' : 'text',
      fileName: filenameMatch ? filenameMatch[1] : null,
      data: text,
      note: 'Data returned inline as text. Copy or save to a file.'
    };
  }

  // Binary response (GeoTIFF, Shapefile, KML, etc.) — cannot pass through MCP
  // Return metadata + direct download URL so user can fetch it themselves
  if (
    contentType.includes('application/octet-stream') ||
    contentType.includes('image/tiff') ||
    contentType.includes('application/zip') ||
    contentType.includes('application/vnd') ||
    contentType.includes('application/geo')
  ) {
    const disposition = response.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^";\s]+)"?/);
    const contentLength = response.headers.get('content-length');

    // Consume the body so the connection is released
    await response.arrayBuffer();

    return {
      success: true,
      format: 'binary',
      contentType,
      fileName: filenameMatch ? filenameMatch[1] : null,
      fileSize: contentLength ? `${(parseInt(contentLength) / 1024).toFixed(1)} KB` : 'unknown',
      downloadUrl: url,
      downloadMethod: method,
      downloadBody: method === 'POST' ? remainingParams : undefined,
      note: 'Binary file (e.g., GeoTIFF, Shapefile). Use the downloadUrl to fetch the file directly, or use the job-based export endpoint for a download link.',
      instructions: 'To download: make the same API request from a browser or HTTP client. The file will download directly.'
    };
  }

  // Fallback: try JSON parse, fall back to text
  try {
    return response.json();
  } catch {
    const text = await response.text();
    return { success: true, data: text };
  }
}
