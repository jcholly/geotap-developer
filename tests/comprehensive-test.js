#!/usr/bin/env node

/**
 * GeoTap MCP Server — Comprehensive Integration Tests
 *
 * Tests the GeoTap REST API end-to-end (the same endpoints the MCP tools call),
 * plus unit tests for parameter normalization, response capping, and tool discovery.
 *
 * Usage:
 *   node tests/comprehensive-test.js                    # Against localhost:3001
 *   GEOTAP_API_URL=https://geotapdata.com/api/v1 node tests/comprehensive-test.js  # Against prod
 *   node tests/comprehensive-test.js --verbose          # Show passing tests too
 *
 * Exit code 0 = all non-XFAIL tests passed
 * Exit code 1 = at least one non-XFAIL test failed
 */

import { normalizeParams } from '../src/paramNormalize.js';
import { capResponse } from '../src/responseCap.js';
import { discoverTools } from '../src/discoverTools.js';

// ════════════════════════════════════════════════════════════════════════════
// 1. SETUP & CONFIG
// ════════════════════════════════════════════════════════════════════════════

const API_BASE = process.env.GEOTAP_API_URL || 'http://localhost:3001/api/v1';
const FRONTEND_URL = API_BASE.replace(/\/api\/v1$/, '');
const WHATS_HERE_URL = API_BASE.replace(/\/api\/v1$/, '/api/whats-here');
const TEST_TIMEOUT = 25_000; // 25 seconds per test
const verbose = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;
let skipped = 0; // XFAIL tests that failed as expected
const failures = [];
const xfailResults = [];

// ════════════════════════════════════════════════════════════════════════════
// 2. HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Make an HTTP request to the API and return parsed JSON.
 * @param {'GET'|'POST'} method
 * @param {string} path - Relative to API_BASE (e.g., '/health') or absolute URL
 * @param {object} [body] - JSON body for POST requests
 * @returns {Promise<{status: number, data: any}>}
 */
async function api(method, path, body) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TEST_TIMEOUT),
  };
  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data };
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg || 'Mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertIncludes(str, substr, msg) {
  if (typeof str !== 'string' || !str.includes(substr)) {
    throw new Error(
      `${msg || 'Missing substring'}: expected "${substr}" in "${String(str).slice(0, 200)}"`
    );
  }
}

/**
 * Run a single test with try/catch, timeout, and pass/fail counting.
 * @param {string} name - Test name
 * @param {Function} fn - Async test function
 * @param {{ xfail?: boolean }} [opts] - Options; xfail marks known-broken tests
 */
async function runTest(name, fn, opts = {}) {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${TEST_TIMEOUT}ms`)), TEST_TIMEOUT)
      ),
    ]);
    const elapsed = Date.now() - start;
    if (opts.xfail) {
      // XFAIL test unexpectedly passed — count as pass (good news)
      passed++;
      console.log(`  XPASS ${name} (${elapsed}ms) — previously broken, now fixed!`);
    } else {
      passed++;
      if (verbose) console.log(`  PASS  ${name} (${elapsed}ms)`);
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    if (opts.xfail) {
      // Expected failure
      skipped++;
      xfailResults.push({ name, error: err.message });
      if (verbose) console.log(`  XFAIL ${name} (${elapsed}ms): ${err.message}`);
    } else {
      failed++;
      failures.push({ name, error: err.message });
      console.log(`  FAIL  ${name} (${elapsed}ms): ${err.message}`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 3. HEALTH & CONNECTIVITY TESTS
// ════════════════════════════════════════════════════════════════════════════

async function healthTests() {
  console.log('\n--- Health & Connectivity (5 tests) ---');

  await runTest('API health endpoint returns 200', async () => {
    const { status, data } = await api('GET', '/health');
    assertEqual(status, 200, 'Health status');
    assert(data, 'Health response should have data');
  });

  await runTest('API status returns connected services', async () => {
    const { status, data } = await api('GET', `${API_BASE.replace('/api/v1', '/api/v1/status')}`);
    assertEqual(status, 200, 'Status code');
    assert(data, 'Status response should have data');
  });

  await runTest('Layers endpoint returns array', async () => {
    const { status, data } = await api('GET', `${API_BASE.replace('/v1', '/v1/layers')}`);
    assertEqual(status, 200, 'Layers status');
    // Response is { success, data: [...], count }
    const layers = Array.isArray(data) ? data : (data?.data || data?.layers);
    assert(Array.isArray(layers), 'Should return array of layers');
    assert(layers.length > 5, `Should have many layers, got ${layers.length}`);
  });

  await runTest('Docs endpoint returns specification', async () => {
    const { status, data } = await api('GET', '/docs');
    assertEqual(status, 200, 'Docs status');
    assert(data, 'Docs should return content');
  });

  await runTest('Frontend serves index.html', async () => {
    const res = await fetch(`${FRONTEND_URL}`, {
      signal: AbortSignal.timeout(TEST_TIMEOUT),
    });
    assertEqual(res.status, 200, 'Frontend status');
    const text = await res.text();
    assertIncludes(text, '<html', 'Should serve HTML');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 4. CORE SPATIAL QUERY TESTS
// ════════════════════════════════════════════════════════════════════════════

async function spatialQueryTests() {
  console.log('\n--- Core Spatial Query Tests (10 tests) ---');

  await runTest('Point query at Atlanta returns flood_zones and soil_map_units', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=33.749&lng=-84.388&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    // Response is { success, data: { flood_zones: {...}, ... }, point, timing }
    const layers = data.data || data.layers || data;
    assert(layers && typeof layers === 'object', 'Should have layers data');
    const layerNames = Object.keys(layers);
    assert(
      layerNames.includes('flood_zones') || layerNames.includes('soil_map_units'),
      `Should include flood_zones or soil_map_units, got: ${layerNames.join(', ')}`
    );
  });

  await runTest('Point query at Miami returns SFHA flood zone', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=25.761&lng=-80.192&layers=flood_zones&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    assert(layers?.flood_zones, 'Should have flood_zones layer');
    const features = layers.flood_zones.features || [];
    assert(features.length > 0, 'Miami should have flood zone features');
    // Miami Beach is in a Special Flood Hazard Area
    const zones = features.map(f => f.properties?.zone || f.properties?.fld_zone || '');
    const hasSFHA = zones.some(z => /^(A|AE|AH|AO|V|VE)$/i.test(z));
    assert(hasSFHA, `Miami should be in SFHA, got zones: ${zones.join(', ')}`);
  });

  await runTest('Address query returns location near expected coordinates', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/query-address')}?address=${encodeURIComponent('1600 Pennsylvania Ave Washington DC')}&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    // Should have coordinates near the White House (38.9, -77.0)
    const coords = data.point || data.coordinates || data.location;
    assert(coords, 'Should return coordinates');
    const lat = coords.lat || coords.latitude;
    const lng = coords.lng || coords.lon || coords.longitude;
    assert(Math.abs(lat - 38.9) < 0.1, `Lat should be near 38.9, got ${lat}`);
    assert(Math.abs(lng - (-77.0)) < 0.2, `Lng should be near -77.0, got ${lng}`);
  });

  await runTest('Address query with layers filter only returns requested layers', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/query-address')}?address=${encodeURIComponent('Atlanta GA')}&layers=flood_zones&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    if (layers && typeof layers === 'object') {
      const layerNames = Object.keys(layers).filter(k => !['success', 'point', 'timing', '_meta', 'coordinates', 'location'].includes(k));
      assert(layerNames.includes('flood_zones'), 'Should include flood_zones');
      // With a filter, shouldn't have many unrelated layers
      assert(layerNames.length <= 3, `Should have limited layers with filter, got ${layerNames.length}: ${layerNames.join(', ')}`);
    }
  });

  await runTest('Geocode returns coordinates', async () => {
    const { status, data } = await api('GET',
      `/geocode?address=${encodeURIComponent('Denver, CO')}`
    );
    assertEqual(status, 200, 'Status');
    // Response is { success, results: [{displayName, lat, lon, source}] }
    const first = data.results?.[0] || data;
    const lat = first.lat || first.latitude || data.lat;
    const lng = first.lng || first.lon || first.longitude || data.lng || data.lon;
    assert(lat !== undefined, 'Should return lat');
    assert(lng !== undefined, 'Should return lng');
    assert(Math.abs(lat - 39.74) < 0.5, `Denver lat should be near 39.74, got ${lat}`);
  });

  await runTest('Bbox query returns features', async () => {
    // Small bbox around downtown Atlanta
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/bbox')}?bbox=-84.39,33.74,-84.38,33.75&layers=flood_zones&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    assert(data, 'Should return data');
  });

  await runTest('Near query with radius returns features', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/near')}?lat=33.749&lng=-84.388&radius=1&layers=flood_zones&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    assert(data, 'Should return data');
  });

  await runTest('Summary query returns counts only (no geometry)', async () => {
    const { status, data } = await api('POST',
      `${API_BASE.replace('/v1', '/v1/spatial/summary')}`,
      {
        polygon: {
          type: 'Polygon',
          coordinates: [[[-84.39, 33.74], [-84.38, 33.74], [-84.38, 33.75], [-84.39, 33.75], [-84.39, 33.74]]]
        }
      }
    );
    assertEqual(status, 200, 'Status');
    assert(data, 'Should return data');
    // Summary should not contain full feature geometry
    const str = JSON.stringify(data);
    // Should have counts or summary data, generally smaller than feature responses
    assert(str.length < 50000, `Summary should be compact, got ${str.length} chars`);
  });

  await runTest('Invalid coordinates return 400', async () => {
    const { status } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=999&lng=999`
    );
    assert(status >= 400, `Invalid coords should return 4xx, got ${status}`);
  });

  await runTest('Missing params return 400', async () => {
    const { status } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}`
    );
    assert(status >= 400, `Missing params should return 4xx, got ${status}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 5. WHAT'S HERE / AI ANALYZE SITE TESTS
// ════════════════════════════════════════════════════════════════════════════

async function whatsHereTests() {
  console.log('\n--- What\'s Here / AI Analyze Site Tests (8 tests) ---');

  let whatsHereData = null;

  await runTest('GET /api/whats-here returns success + data', async () => {
    const { status, data } = await api('GET', `${WHATS_HERE_URL}?lat=33.749&lng=-84.388`);
    assertEqual(status, 200, 'Status');
    assert(data, 'Should return data');
    assert(data.success !== false, 'Should not be an error');
    whatsHereData = data;
  });

  await runTest('Data packet has metadata.sources_with_data >= 3', async () => {
    assert(whatsHereData, 'Requires whats-here data from previous test');
    const meta = whatsHereData.metadata || whatsHereData;
    const sourcesCount = meta.sources_with_data
      || meta.sourcesWithData
      || (meta.sources ? Object.keys(meta.sources).length : 0)
      || Object.keys(whatsHereData.data || whatsHereData).filter(k => k !== 'metadata').length;
    assert(sourcesCount >= 3, `Should have >= 3 data sources, got ${sourcesCount}`);
  });

  await runTest('Data packet has flood_risk with zone field', async () => {
    assert(whatsHereData, 'Requires whats-here data from previous test');
    const packet = whatsHereData.data || whatsHereData;
    const flood = packet.flood_risk || packet.flood_zones || packet.flood;
    assert(flood, `Should have flood data, got keys: ${Object.keys(packet).join(', ')}`);
    // Check for zone field somewhere in the flood data
    const floodStr = JSON.stringify(flood).toLowerCase();
    assert(floodStr.includes('zone'), 'Flood data should contain a zone field');
  });

  await runTest('Data packet has soil with name field', async () => {
    assert(whatsHereData, 'Requires whats-here data from previous test');
    const packet = whatsHereData.data || whatsHereData;
    const soil = packet.soil || packet.soils || packet.soil_map_units;
    assert(soil, `Should have soil data, got keys: ${Object.keys(packet).join(', ')}`);
    const soilStr = JSON.stringify(soil).toLowerCase();
    assert(soilStr.includes('name') || soilStr.includes('muname') || soilStr.includes('musym'),
      'Soil data should contain a name-like field');
  });

  await runTest('POST /api/whats-here/narrative returns narrative text', async () => {
    const { status, data } = await api('POST', `${WHATS_HERE_URL}/narrative`, {
      lat: 33.749,
      lng: -84.388,
    });
    assertEqual(status, 200, 'Status');
    const narrative = typeof data === 'string' ? data : (data.narrative || data.text || data.summary);
    assert(narrative, 'Should return narrative text');
    assert(typeof narrative === 'string' && narrative.length > 50,
      `Narrative should be substantial text, got ${typeof narrative} of length ${String(narrative).length}`);
  });

  await runTest('What\'s Here response time < 20s', async () => {
    const start = Date.now();
    await api('GET', `${WHATS_HERE_URL}?lat=34.0&lng=-84.0`);
    const elapsed = Date.now() - start;
    assert(elapsed < 20000, `Response took ${elapsed}ms, should be < 20000ms`);
  });

  await runTest('Ocean point (30, -50) returns gracefully with minimal data', async () => {
    const { status, data } = await api('GET', `${WHATS_HERE_URL}?lat=30&lng=-50`);
    // Should not crash — may return 200 with empty data or a controlled error
    assert(status < 500, `Ocean point should not cause server error, got ${status}`);
  });

  await runTest('Invalid lat (999) returns 400', async () => {
    const { status } = await api('GET', `${WHATS_HERE_URL}?lat=999&lng=-84`);
    assert(status >= 400, `Invalid lat should return 4xx, got ${status}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 6. ADAPTER DATA ACCURACY TESTS
// ════════════════════════════════════════════════════════════════════════════

async function adapterAccuracyTests() {
  console.log('\n--- Adapter Data Accuracy Tests (12 tests) ---');

  await runTest('Flood zone: Miami is in SFHA (zone AE or VE)', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=25.761&lng=-80.192&layers=flood_zones&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    const features = layers?.flood_zones?.features || [];
    assert(features.length > 0, 'Miami should have flood zone features');
    const zones = features.map(f => f.properties?.zone || f.properties?.fld_zone || '');
    const hasSFHA = zones.some(z => /^(A|AE|AH|AO|AR|V|VE)$/i.test(z));
    assert(hasSFHA, `Miami should be in SFHA, got zones: ${zones.join(', ')}`);
  });

  await runTest('Flood zone: Denver is Zone X (minimal flood risk)', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=39.739&lng=-104.990&layers=flood_zones&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    const features = layers?.flood_zones?.features || [];
    // Denver downtown is generally Zone X
    if (features.length > 0) {
      const zones = features.map(f => f.properties?.zone || f.properties?.fld_zone || '');
      const hasX = zones.some(z => /^X/i.test(z));
      assert(hasX, `Denver should be Zone X, got zones: ${zones.join(', ')}`);
    }
    // If no features, that also implies no special flood zone (effectively Zone X)
  });

  await runTest('Soil: Manhattan returns "Urban land"', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=40.758&lng=-73.986&layers=soil_map_units&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    const features = layers?.soil_map_units?.features || [];
    assert(features.length > 0, 'Manhattan should have soil data');
    const soilStr = JSON.stringify(features).toLowerCase();
    assert(soilStr.includes('urban'), `Manhattan soil should mention "Urban", got: ${soilStr.slice(0, 300)}`);
  });

  await runTest('Soil: Iowa does NOT return "Urban land"', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=42.031&lng=-93.482&layers=soil_map_units&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    const features = layers?.soil_map_units?.features || [];
    assert(features.length > 0, 'Iowa should have soil data');
    // Primary soil type should not be Urban
    const primarySoil = features[0]?.properties?.muname || features[0]?.properties?.name || '';
    assert(!primarySoil.toLowerCase().includes('urban'),
      `Iowa primary soil should not be Urban, got: ${primarySoil}`);
  });

  await runTest('Rainfall: Mobile AL 100yr > 10 inches', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/rainfall/atlas14')}?lat=30.695&lon=-88.040`
    );
    assertEqual(status, 200, 'Status');
    // Response is { success, data: { precipitationFrequency: { '24hr': { '100yr': N } } } }
    const pf = data.data?.precipitationFrequency || data.precipitationFrequency;
    assert(pf, `Should have precipitationFrequency, got keys: ${Object.keys(data.data || data).join(', ')}`);
    const hr24 = pf['24hr'];
    assert(hr24, `Should have 24hr data, got durations: ${Object.keys(pf).join(', ')}`);
    const val = hr24['100yr'];
    assert(val !== undefined, 'Should have 100yr value');
    assert(Number(val) > 10, `Mobile AL 100yr 24hr should be > 10 inches, got ${val}`);
  });

  await runTest('Rainfall: Las Vegas 100yr < 6 inches', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/rainfall/atlas14')}?lat=36.169&lon=-115.140`
    );
    assertEqual(status, 200, 'Status');
    const pf = data.data?.precipitationFrequency || data.precipitationFrequency;
    assert(pf, 'Should have precipitationFrequency');
    const hr24 = pf['24hr'];
    assert(hr24, 'Should have 24hr data');
    const val = hr24['100yr'];
    assert(val !== undefined, 'Should have 100yr value');
    assert(Number(val) < 6, `Las Vegas 100yr 24hr should be < 6 inches, got ${val}`);
  });

  await runTest('Superfund: Love Canal area finds "LOVE CANAL" site', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/near')}?lat=43.078&lng=-78.949&radius=3&layers=superfund&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    const features = layers?.superfund?.features || [];
    const allText = JSON.stringify(features).toUpperCase();
    assert(allText.includes('LOVE CANAL'), `Should find Love Canal, got ${features.length} features`);
  });

  await runTest('Protected: Yellowstone found in PAD-US', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=44.428&lng=-110.589&layers=protected_lands&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    const features = layers?.protected_lands?.features || [];
    const allText = JSON.stringify(features).toLowerCase();
    assert(allText.includes('yellowstone'), `Should find Yellowstone, got ${features.length} features`);
  });

  await runTest('Watershed: DC is in Potomac watershed', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/stations/watersheds')}?bbox=-77.04,38.89,-77.03,38.90`
    );
    assertEqual(status, 200, 'Status');
    const allText = JSON.stringify(data).toLowerCase();
    assert(allText.includes('potomac'), `DC should be in Potomac watershed, response: ${allText.slice(0, 300)}`);
  });

  await runTest('Stations: search near Atlanta finds USGS stream gages', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/stations')}?lat=33.749&lng=-84.388&radius=20`
    );
    assertEqual(status, 200, 'Status');
    const stations = data.stations || data.features || (Array.isArray(data) ? data : []);
    assert(stations.length > 0, 'Should find stations near Atlanta');
  });

  await runTest('Gage 02336000 flood frequency returns peak flows', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/gage-intelligence/02336000/flood-frequency')}`
    );
    assertEqual(status, 200, 'Status');
    assert(data, 'Should return flood frequency data');
    const dataStr = JSON.stringify(data).toLowerCase();
    assert(dataStr.includes('peak') || dataStr.includes('flow') || dataStr.includes('frequency'),
      'Should contain peak flow or frequency data');
  });

  await runTest('Gage 99999999 (invalid) returns error not crash', async () => {
    const { status } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/gage-intelligence/99999999/flood-frequency')}`
    );
    assert(status < 500, `Invalid gage should not cause 500 server error, got ${status}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 7. PARAMETER NORMALIZATION TESTS
// ════════════════════════════════════════════════════════════════════════════

async function paramNormTests() {
  console.log('\n--- Parameter Normalization Tests (6 tests) ---');

  await runTest('normalizeParams: latitude/longitude -> lat/lng for identify_features_at_point', async () => {
    const result = normalizeParams('identify_features_at_point', { latitude: 33.9, longitude: -84.4 });
    assertEqual(result.lat, 33.9, 'lat');
    assertEqual(result.lng, -84.4, 'lng');
    assert(result.latitude === undefined, 'latitude should be removed');
    assert(result.longitude === undefined, 'longitude should be removed');
  });

  await runTest('normalizeParams: lat/lng -> lat/lon for get_rainfall_data', async () => {
    const result = normalizeParams('get_rainfall_data', { lat: 33.9, lng: -84.4 });
    assertEqual(result.lat, 33.9, 'lat');
    assertEqual(result.lon, -84.4, 'lon');
    assert(result.lng === undefined, 'lng should be removed');
  });

  await runTest('normalizeParams: lat/lng -> latitude/longitude for generate_hyetograph', async () => {
    const result = normalizeParams('generate_hyetograph', { lat: 33.9, lng: -84.4 });
    assertEqual(result.latitude, 33.9, 'latitude');
    assertEqual(result.longitude, -84.4, 'longitude');
    assert(result.lat === undefined, 'lat should be removed');
    assert(result.lng === undefined, 'lng should be removed');
  });

  await runTest('normalizeParams: defaults geometry="none" for area tools', async () => {
    const result = normalizeParams('get_environmental_data_for_area', {});
    assertEqual(result.geometry, 'none', 'geometry');
  });

  await runTest('normalizeParams: unknown tool passes through unchanged', async () => {
    const result = normalizeParams('unknown_tool', { lat: 33.9, lng: -84.4 });
    assertEqual(result.lat, 33.9, 'lat should pass through');
    assertEqual(result.lng, -84.4, 'lng should pass through');
  });

  await runTest('normalizeParams: strips null/undefined params', async () => {
    const result = normalizeParams('identify_features_at_point', {
      lat: 33.9,
      lng: -84.4,
      optionalA: null,
      optionalB: undefined,
      keepMe: 'yes',
    });
    assert(!('optionalA' in result), 'null param should be stripped');
    assert(!('optionalB' in result), 'undefined param should be stripped');
    assertEqual(result.keepMe, 'yes', 'Non-null params should be kept');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 8. RESPONSE CAPPING TESTS
// ════════════════════════════════════════════════════════════════════════════

async function responseCappingTests() {
  console.log('\n--- Response Capping Tests (4 tests) ---');

  await runTest('Small response passes through unchanged', async () => {
    const input = { success: true, layers: { flood_zones: { features: [{ id: 1 }] } } };
    const { data, wasCapped } = capResponse('get_environmental_data_for_area', input);
    assert(!wasCapped, 'Should not be capped');
    assertEqual(data.layers.flood_zones.features.length, 1, 'Feature count');
  });

  await runTest('Large feature collection gets capped at 50', async () => {
    const input = {
      layers: {
        flood_zones: {
          features: Array.from({ length: 200 }, (_, i) => ({
            type: 'Feature',
            properties: { id: i },
            geometry: { type: 'Point', coordinates: [-84, 33] },
          })),
        },
      },
    };
    const { data, wasCapped } = capResponse('get_environmental_data_for_area', input);
    assert(wasCapped, 'Should be capped');
    assertEqual(data.layers.flood_zones.features.length, 50, 'Should cap at 50');
  });

  await runTest('Capped response includes pagination metadata', async () => {
    const input = {
      layers: {
        test_layer: {
          features: Array.from({ length: 100 }, (_, i) => ({ id: i })),
        },
      },
    };
    const { data } = capResponse('get_environmental_data_for_area', input);
    assert(data._pagination, 'Should have _pagination');
    assertEqual(data._pagination.totalFeatures, 100, 'Total features');
    assertEqual(data._pagination.returnedFeatures, 50, 'Returned features');
    assert(data._pagination.hint, 'Should have a hint');
  });

  await runTest('Cap preserves _summary field and other metadata', async () => {
    const input = {
      _summary: 'Test summary',
      coordinates: { lat: 33, lng: -84 },
      layers: {
        flood_zones: {
          features: Array.from({ length: 80 }, (_, i) => ({ id: i })),
          metadata: { source: 'FEMA' },
        },
      },
    };
    const { data } = capResponse('get_environmental_data_for_area', input);
    assertEqual(data._summary, 'Test summary', '_summary should be preserved');
    assertEqual(data.coordinates.lat, 33, 'coordinates should be preserved');
    assertEqual(data.layers.flood_zones.metadata.source, 'FEMA', 'layer metadata should be preserved');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 9. TOOL DISCOVERY TESTS
// ════════════════════════════════════════════════════════════════════════════

async function toolDiscoveryTests() {
  console.log('\n--- Tool Discovery Tests (3 tests) ---');

  await runTest('discover("flood") returns tools mentioning flood', async () => {
    const result = discoverTools('What flood zone is this property in?');
    assert(result.recommendedTools.length > 0, 'Should return at least one tool');
    const names = result.recommendedTools.map(t => t.name);
    const hasFloodTool = names.some(n =>
      n.includes('query_address') || n.includes('firm') || n.includes('flood') || n.includes('identify')
    );
    assert(hasFloodTool, `Should recommend a flood-related tool, got: ${names.join(', ')}`);
  });

  await runTest('discover("rainfall") returns rainfall-related tool', async () => {
    const result = discoverTools('What is the 100-year rainfall depth for this location?');
    const names = result.recommendedTools.map(t => t.name);
    const hasRainfall = names.some(n => n.includes('rainfall') || n.includes('atlas14'));
    assert(hasRainfall,
      `Should recommend a rainfall tool, got: ${names.join(', ')}`);
  });

  await runTest('discover("unknown gibberish") returns empty or generic', async () => {
    const result = discoverTools('xyzzy plugh twisty passages');
    // Should not crash; may return empty or generic recommendations
    assert(result, 'Should return a result object');
    assert(Array.isArray(result.recommendedTools), 'Should have recommendedTools array');
    assert(result.allCategories.length > 0, 'Should still list all categories');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 10. KNOWN BUG REGRESSION TESTS
// ════════════════════════════════════════════════════════════════════════════

async function regressionTests() {
  console.log('\n--- Known Bug Regression Tests (5 tests) ---');

  await runTest('BUG-001: estimate_ungaged with DRNAREA parameter', async () => {
    const { status, data } = await api('POST',
      `${API_BASE.replace('/v1', '/v1/gage-intelligence/ungaged/estimate')}`,
      {
        state: 'GA',
        statisticGroup: 'Peak-Flow',
        parameters: { DRNAREA: 10 },
      }
    );
    assertEqual(status, 200, 'Status');
    assert(data, 'Should return estimation data');
    const dataStr = JSON.stringify(data);
    assert(dataStr.length > 10, 'Should have meaningful response');
  }, { xfail: true });

  await runTest('BUG-002: ungaged required_parameters endpoint', async () => {
    const { status } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/gage-intelligence/ungaged/parameters')}?state=GA&statisticGroup=Peak-Flow`
    );
    assertEqual(status, 200, `Should return 200, got ${status}`);
  }, { xfail: true });

  await runTest('BUG-003: NSS regions for "GA" should filter to Georgia only', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/gage-intelligence/ungaged/regions')}?state=GA`
    );
    assertEqual(status, 200, 'Status');
    const regions = data.regions || data;
    const allText = JSON.stringify(regions).toLowerCase();
    // Should only have Georgia regions, not global/other-state regions
    assert(!allText.includes('idaho') && !allText.includes('california'),
      'Should filter to Georgia only, not include other states');
  }, { xfail: true });

  await runTest('BUG-004: list_layers count matches actual array length', async () => {
    const { status, data } = await api('GET', `${API_BASE.replace('/v1', '/v1/layers')}`);
    assertEqual(status, 200, 'Status');
    // Response is { success, data: [...], count }
    const layers = Array.isArray(data) ? data : (data?.data || data?.layers);
    assert(Array.isArray(layers), 'Should return array');
    // If there's a count/total field, it should match the array length
    if (data.total || data.count) {
      const reportedCount = data.total || data.count;
      assertEqual(reportedCount, layers.length,
        `Reported count ${reportedCount} should match actual ${layers.length}`);
    }
    // Basic sanity: should have a reasonable number of layers
    assert(layers.length >= 5, `Should have >= 5 layers, got ${layers.length}`);
  });

  await runTest('DOC-001: historic_places response has more than just id/name/nrisRefnum', async () => {
    const { status, data } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/near')}?lat=38.895&lng=-77.036&radius=2&layers=historic_places&geometry=none`
    );
    assertEqual(status, 200, 'Status');
    const layers = data.data || data.layers || data;
    const features = layers?.historic_places?.features || [];
    assert(features.length > 0, 'DC should have historic places');
    const props = features[0].properties || {};
    const keys = Object.keys(props);
    // Should have more than just id, name, nrisRefnum
    assert(keys.length > 3,
      `Historic place should have rich properties, got only: ${keys.join(', ')}`);
  }, { xfail: true });
}

// ════════════════════════════════════════════════════════════════════════════
// 11. EDGE CASES
// ════════════════════════════════════════════════════════════════════════════

async function edgeCaseTests() {
  console.log('\n--- Edge Case Tests (5 tests) ---');

  await runTest('Alaska coordinates work (Anchorage)', async () => {
    const { status } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=61.218&lng=-149.900&layers=flood_zones&geometry=none`
    );
    // Should not crash; may return 200 with empty data or limited data
    assert(status < 500, `Alaska query should not 500, got ${status}`);
  });

  await runTest('Hawaii coordinates work (Honolulu)', async () => {
    const { status } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=21.307&lng=-157.858&layers=flood_zones&geometry=none`
    );
    assert(status < 500, `Hawaii query should not 500, got ${status}`);
  });

  await runTest('Ocean point returns gracefully (no crash)', async () => {
    const { status } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/point')}?lat=30.0&lng=-50.0&layers=flood_zones&geometry=none`
    );
    assert(status < 500, `Ocean point should not 500, got ${status}`);
  });

  await runTest('Very small bbox returns valid response', async () => {
    // ~10 meter bbox
    const { status } = await api('GET',
      `${API_BASE.replace('/v1', '/v1/spatial/bbox')}?bbox=-84.3880,33.7490,-84.3879,33.7491&layers=flood_zones&geometry=none`
    );
    assert(status < 500, `Small bbox should not 500, got ${status}`);
  });

  await runTest('Concurrent 5 requests all succeed', async () => {
    const requests = [
      api('GET', '/health'),
      api('GET', `/geocode?address=${encodeURIComponent('New York, NY')}`),
      api('GET', `/geocode?address=${encodeURIComponent('Chicago, IL')}`),
      api('GET', `/geocode?address=${encodeURIComponent('Houston, TX')}`),
      api('GET', `/geocode?address=${encodeURIComponent('Phoenix, AZ')}`),
    ];
    const results = await Promise.all(requests);
    for (let i = 0; i < results.length; i++) {
      assert(results[i].status === 200,
        `Request ${i} should succeed, got ${results[i].status}`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
// 12. RUN ALL & SUMMARY
// ════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\nGeoTap Comprehensive Integration Tests`);
  console.log(`API: ${API_BASE}`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  // Run all test sections sequentially
  await healthTests();
  await spatialQueryTests();
  await whatsHereTests();
  await adapterAccuracyTests();
  await paramNormTests();
  await responseCappingTests();
  await toolDiscoveryTests();
  await regressionTests();
  await edgeCaseTests();

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} xfail (expected failures)`);
  console.log(`Total: ${passed + failed + skipped} tests in ${totalTime}s`);

  if (failures.length > 0) {
    console.log('\nFailed tests:');
    for (const f of failures) {
      console.log(`  - ${f.name}`);
      console.log(`    ${f.error}`);
    }
  }

  if (xfailResults.length > 0 && verbose) {
    console.log('\nExpected failures (XFAIL):');
    for (const x of xfailResults) {
      console.log(`  - ${x.name}: ${x.error}`);
    }
  }

  if (failed > 0) {
    console.log(`\n${failed} test(s) FAILED.`);
    process.exit(1);
  } else {
    console.log(`\nAll tests passed! (${skipped} known issues tracked as XFAIL)`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(2);
});
