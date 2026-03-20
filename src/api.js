const BASE_URL = process.env.GEOTAP_API_URL || 'https://geotapdata.com/api/v1';
const API_KEY = process.env.GEOTAP_API_KEY || '';

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
    'User-Agent': 'geotap-mcp-server/1.0.0'
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
    throw new Error(`GeoTap API error (${response.status}): ${errorText}`);
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
