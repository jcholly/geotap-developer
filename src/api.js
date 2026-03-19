const BASE_URL = process.env.GEOTAP_API_URL || 'https://geotap.us/api/v1';
const API_KEY = process.env.GEOTAP_API_KEY || '';

/**
 * Call the GeoTap API.
 * Handles both GET (query params) and POST (JSON body) requests.
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
        searchParams.append(key, String(value));
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

  return response.json();
}
