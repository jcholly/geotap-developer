#!/usr/bin/env node

/**
 * GeoTap MCP Server — Unit Tests for v1.3.0 Improvements
 *
 * Tests all 5 new features:
 *   1. Response size capping + smart pagination
 *   2. Natural language summaries
 *   3. Lat/lng auto-conversion
 *   4. Tool discovery (discover_tools)
 *   5. Structured errors + llms.txt
 *
 * Usage:
 *   node tests/unit-tests.js
 *   node tests/unit-tests.js --verbose
 */

import { capResponse } from '../src/responseCap.js';
import { generateSummary } from '../src/summaries.js';
import { convertLatLng } from '../src/latLngHelper.js';
import { discoverTools } from '../src/discoverTools.js';
import { StructuredApiError } from '../src/api.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    if (verbose) console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ════════════════════════════════════════════════════════════════════
// 1. RESPONSE SIZE CAPPING
// ════════════════════════════════════════════════════════════════════

console.log('\n📦 Response Size Capping');

test('capResponse: passes through small responses unchanged', () => {
  const result = { success: true, data: 'small' };
  const { data, wasCapped } = capResponse('check_api_status', result);
  assert(!wasCapped, 'Should not be capped');
  assertEqual(data.data, 'small');
});

test('capResponse: caps features in layered response', () => {
  const bigLayer = {
    layers: {
      flood_zones: {
        features: Array.from({ length: 100 }, (_, i) => ({
          type: 'Feature',
          properties: { id: i },
          geometry: { type: 'Point', coordinates: [-81, 32] }
        }))
      }
    }
  };
  const { data, wasCapped, capInfo } = capResponse('get_environmental_data_for_area', bigLayer);
  assert(wasCapped, 'Should be capped');
  assertEqual(data.layers.flood_zones.features.length, 50, 'Should cap at 50 features');
  assert(data._pagination, 'Should have _pagination field');
  assertEqual(data._pagination.totalFeatures, 100);
  assertEqual(data._pagination.returnedFeatures, 50);
});

test('capResponse: caps direct feature collections', () => {
  const fc = {
    type: 'FeatureCollection',
    features: Array.from({ length: 200 }, (_, i) => ({
      type: 'Feature',
      properties: { id: i }
    }))
  };
  const { data, wasCapped } = capResponse('get_environmental_data_near_point', fc);
  assert(wasCapped, 'Should be capped');
  assertEqual(data.features.length, 50);
  assert(data._pagination, 'Should have _pagination');
  assertEqual(data._pagination.totalFeatures, 200);
});

test('capResponse: does not cap non-feature-heavy tools', () => {
  const result = {
    features: Array.from({ length: 100 }, (_, i) => ({ id: i }))
  };
  const { wasCapped } = capResponse('get_rainfall_data', result);
  assert(!wasCapped, 'Rainfall data should not be capped');
});

test('capResponse: handles null/undefined gracefully', () => {
  const { data, wasCapped } = capResponse('some_tool', null);
  assert(!wasCapped);
  assertEqual(data, null);
});

test('capResponse: handles empty layers', () => {
  const result = { layers: { flood_zones: { features: [] } } };
  const { wasCapped } = capResponse('get_environmental_data_for_area', result);
  assert(!wasCapped, 'Empty layers should not trigger capping');
});

test('capResponse: preserves non-feature data in capped response', () => {
  const result = {
    layers: {
      flood_zones: {
        features: Array.from({ length: 60 }, (_, i) => ({ id: i })),
        metadata: { source: 'FEMA' }
      }
    },
    coordinates: { lat: 32, lng: -81 }
  };
  const { data } = capResponse('get_environmental_data_for_area', result);
  assertEqual(data.coordinates.lat, 32, 'Should preserve top-level data');
  assertEqual(data.layers.flood_zones.metadata.source, 'FEMA', 'Should preserve layer metadata');
});

test('capResponse: generates per-layer summary when capped', () => {
  const result = {
    layers: {
      flood_zones: { features: Array.from({ length: 80 }, () => ({})) },
      wetlands: { features: Array.from({ length: 30 }, () => ({})) }
    }
  };
  const { data } = capResponse('get_environmental_data_for_area', result);
  assert(data._pagination.layerSummary.flood_zones.wasCapped, 'flood_zones should be marked capped');
  assert(!data._pagination.layerSummary.wetlands.wasCapped, 'wetlands should NOT be marked capped');
});

// ════════════════════════════════════════════════════════════════════
// 2. NATURAL LANGUAGE SUMMARIES
// ════════════════════════════════════════════════════════════════════

console.log('\n📝 Natural Language Summaries');

test('generateSummary: query_address produces summary', () => {
  const summary = generateSummary('query_address', { address: '123 Main St' }, {
    coordinates: { lat: 32.08, lng: -81.09 },
    layers: {
      flood_zones: { features: [{ properties: { zone: 'AE' } }] },
      wetlands: { features: [] }
    }
  });
  assert(summary, 'Should produce a summary');
  assert(summary.includes('123 Main St'), 'Should mention address');
  assert(summary.includes('32.08'), 'Should mention coordinates');
  assert(summary.includes('Flood Zones'), 'Should mention found layers');
});

test('generateSummary: get_rainfall_data with depths', () => {
  const summary = generateSummary('get_rainfall_data', { lat: 32, lon: -81 }, {
    depths: { '100': { '24hr': 7.82 }, '10': { '24hr': 5.24 } }
  });
  assert(summary, 'Should produce a summary');
  assert(summary.includes('7.82'), 'Should include 100-yr depth');
  assert(summary.includes('5.24'), 'Should include 10-yr depth');
});

test('generateSummary: geocode_address', () => {
  const summary = generateSummary('geocode_address', { address: 'Austin TX' }, {
    lat: 30.26, lng: -97.74, formattedAddress: 'Austin, TX'
  });
  assert(summary.includes('30.26'), 'Should mention lat');
  assert(summary.includes('Austin'), 'Should mention address');
});

test('generateSummary: delineate_watershed', () => {
  const summary = generateSummary('delineate_watershed', { lat: 32, lng: -81 }, {
    characteristics: { drainageArea: 15.3, meanBasinSlope: 2.1 }
  });
  assert(summary.includes('15.3'), 'Should mention drainage area');
});

test('generateSummary: handles null/error results gracefully', () => {
  const summary = generateSummary('query_address', { address: 'test' }, null);
  assertEqual(summary, null, 'Should return null for null result');
});

test('generateSummary: error response', () => {
  const summary = generateSummary('some_tool', {}, { success: false, error: 'something broke' });
  assert(summary.includes('failed'), 'Should mention failure');
});

test('generateSummary: fallback for unknown tools', () => {
  const summary = generateSummary('some_new_tool', {}, { foo: 'bar', baz: 123 });
  assert(summary, 'Should produce a fallback summary');
  assert(summary.includes('foo'), 'Should list response keys');
});

test('generateSummary: list_data_layers', () => {
  const summary = generateSummary('list_data_layers', {}, {
    layers: Array.from({ length: 37 }, () => ({}))
  });
  assert(summary.includes('37'), 'Should mention layer count');
});

test('generateSummary: spatial area tool', () => {
  const summary = generateSummary('get_environmental_data_near_point', { lat: 32, lng: -81, radius: 2 }, {
    layers: {
      flood_zones: { features: [{}, {}] },
      wetlands: { features: [{}] }
    }
  });
  assert(summary.includes('2km'), 'Should mention radius');
  assert(summary.includes('3 total features'), 'Should count total features');
});

test('generateSummary: export_data with jobId', () => {
  const summary = generateSummary('export_data', { format: 'geojson' }, {
    jobId: 'abc123'
  });
  assert(summary.includes('abc123'), 'Should mention job ID');
  assert(summary.includes('geojson'), 'Should mention format');
});

test('generateSummary: category fallback for rainfall tools', () => {
  const summary = generateSummary('get_design_approaches', {}, {
    approaches: [{ name: 'mean' }]
  });
  assert(summary, 'Should produce a fallback summary');
});

// ════════════════════════════════════════════════════════════════════
// 3. LAT/LNG AUTO-CONVERSION
// ════════════════════════════════════════════════════════════════════

console.log('\n🌍 Lat/Lng Auto-Conversion');

test('convertLatLng: converts lat/lng to Point for site analysis', () => {
  const result = convertLatLng('generate_site_analysis', { lat: 32.08, lng: -81.09, projectName: 'Test' });
  assert(result.geometry, 'Should have geometry');
  assertEqual(result.geometry.type, 'Point');
  assertEqual(result.geometry.coordinates[0], -81.09, 'Lng should be first (GeoJSON order)');
  assertEqual(result.geometry.coordinates[1], 32.08, 'Lat should be second');
  assert(!result.lat, 'Should remove lat from params');
  assert(!result.lng, 'Should remove lng from params');
  assertEqual(result.projectName, 'Test', 'Should preserve other params');
  assert(result._latLngConverted, 'Should have conversion info');
});

test('convertLatLng: converts lat/lng to bbox polygon for area query', () => {
  const result = convertLatLng('get_environmental_data_for_area', { lat: 32.08, lng: -81.09 });
  assert(result.polygon, 'Should have polygon');
  assertEqual(result.polygon.type, 'Polygon');
  assertEqual(result.polygon.coordinates[0].length, 5, 'Should have 5 points (closed ring)');
  // Verify the bbox roughly contains the point
  const coords = result.polygon.coordinates[0];
  assert(coords[0][0] < -81.09, 'West should be less than lng');
  assert(coords[2][0] > -81.09, 'East should be greater than lng');
});

test('convertLatLng: converts lat/lng to FeatureCollection for catchments', () => {
  const result = convertLatLng('analyze_curve_numbers', { lat: 32, lng: -81 });
  assert(result.catchments, 'Should have catchments');
  assertEqual(result.catchments.type, 'FeatureCollection');
  assertEqual(result.catchments.features.length, 1);
  assertEqual(result.catchments.features[0].geometry.type, 'Polygon');
});

test('convertLatLng: skips conversion when geometry already provided', () => {
  const geom = { type: 'Point', coordinates: [-81, 32] };
  const result = convertLatLng('generate_site_analysis', { lat: 32, lng: -81, geometry: geom });
  assertEqual(result.geometry, geom, 'Should keep original geometry');
  assertEqual(result.lat, 32, 'Should keep lat when geometry is present');
});

test('convertLatLng: skips conversion for non-geometry tools', () => {
  const params = { lat: 32, lng: -81 };
  const result = convertLatLng('get_rainfall_data', params);
  assertEqual(result.lat, 32, 'Should not touch lat');
  assertEqual(result.lng, -81, 'Should not touch lng');
});

test('convertLatLng: handles lon alias', () => {
  const result = convertLatLng('generate_site_analysis', { lat: 32, lon: -81 });
  assert(result.geometry, 'Should convert with lon alias');
  assertEqual(result.geometry.coordinates[0], -81);
});

test('convertLatLng: handles missing lat/lng gracefully', () => {
  const result = convertLatLng('generate_site_analysis', { projectName: 'Test' });
  assert(!result.geometry, 'Should not create geometry without lat/lng');
  assertEqual(result.projectName, 'Test');
});

test('convertLatLng: handles null params', () => {
  const result = convertLatLng('generate_site_analysis', null);
  assertEqual(result, null);
});

test('convertLatLng: uses custom radius for bbox', () => {
  const small = convertLatLng('get_environmental_data_for_area', { lat: 32, lng: -81, radius: 0.1 });
  const large = convertLatLng('get_environmental_data_for_area', { lat: 32, lng: -81, radius: 5 });
  const smallArea = Math.abs(small.polygon.coordinates[0][2][0] - small.polygon.coordinates[0][0][0]);
  const largeArea = Math.abs(large.polygon.coordinates[0][2][0] - large.polygon.coordinates[0][0][0]);
  assert(largeArea > smallArea, 'Larger radius should produce larger bbox');
});

test('convertLatLng: converts for water quality (location param)', () => {
  const result = convertLatLng('get_water_quality', { lat: 32, lng: -81 });
  assert(result.location, 'Should have location');
  assertEqual(result.location.type, 'Point');
});

test('convertLatLng: converts for export_data (geometry param)', () => {
  const result = convertLatLng('export_data', { lat: 32, lng: -81, layers: ['flood_zones'], format: 'geojson' });
  assert(result.geometry, 'Should have geometry');
  assertEqual(result.geometry.type, 'Point');
  assert(result.layers, 'Should preserve layers');
});

// ════════════════════════════════════════════════════════════════════
// 4. TOOL DISCOVERY
// ════════════════════════════════════════════════════════════════════

console.log('\n🔍 Tool Discovery');

test('discoverTools: finds flood-related tools', () => {
  const result = discoverTools('What flood zone is this property in?');
  assert(result.recommendedTools.length > 0, 'Should find tools');
  const names = result.recommendedTools.map(t => t.name);
  assert(names.includes('query_address') || names.includes('get_firm_panels'), 'Should recommend flood tools');
});

test('discoverTools: finds rainfall tools', () => {
  const result = discoverTools('What is the 100-year rainfall for this location?');
  const names = result.recommendedTools.map(t => t.name);
  assert(names.includes('get_rainfall_data'), 'Should recommend get_rainfall_data');
});

test('discoverTools: finds watershed tools', () => {
  const result = discoverTools('Delineate the watershed and calculate drainage area');
  const names = result.recommendedTools.map(t => t.name);
  assert(names.includes('delineate_watershed'), 'Should recommend delineate_watershed');
});

test('discoverTools: finds gage tools', () => {
  const result = discoverTools('What is the flood frequency for USGS gage 08158000?');
  const names = result.recommendedTools.map(t => t.name);
  assert(names.includes('get_flood_frequency_analysis') || names.includes('get_gage_summary'),
    'Should recommend gage tools');
});

test('discoverTools: finds permit tools', () => {
  const result = discoverTools('What permits do I need for construction near a stream?');
  const names = result.recommendedTools.map(t => t.name);
  assert(names.some(n => n.includes('permit') || n.includes('water_features')),
    'Should recommend permit tools');
});

test('discoverTools: finds site analysis tools', () => {
  const result = discoverTools('Can I build on this site? Environmental assessment');
  const names = result.recommendedTools.map(t => t.name);
  assert(names.some(n => n.includes('site_analysis') || n.includes('developability') || n.includes('constraints')),
    'Should recommend site analysis tools');
});

test('discoverTools: returns matched categories', () => {
  const result = discoverTools('rainfall and flood zone');
  assert(result.matchedCategories.length > 0, 'Should have matched categories');
});

test('discoverTools: respects maxResults', () => {
  const result = discoverTools('environmental data', 3);
  assert(result.recommendedTools.length <= 3, 'Should respect maxResults');
});

test('discoverTools: provides hint', () => {
  const result = discoverTools('water quality impairments');
  assert(result.hint, 'Should provide a hint');
  assert(result.hint.length > 0);
});

test('discoverTools: handles vague queries', () => {
  const result = discoverTools('help me');
  assert(result.allCategories.length > 0, 'Should return all categories');
  assert(result.totalToolsAvailable > 60, 'Should report total tools');
});

test('discoverTools: elevation queries', () => {
  const result = discoverTools('What is the terrain elevation and slope?');
  const names = result.recommendedTools.map(t => t.name);
  assert(names.some(n => n.includes('elevation') || n.includes('dem') || n.includes('contour')),
    'Should recommend elevation tools');
});

test('discoverTools: export queries', () => {
  const result = discoverTools('I need to download a shapefile of the data');
  const names = result.recommendedTools.map(t => t.name);
  assert(names.some(n => n.includes('export')), 'Should recommend export tools');
});

// ════════════════════════════════════════════════════════════════════
// 5. STRUCTURED ERRORS & LLMS.TXT
// ════════════════════════════════════════════════════════════════════

console.log('\n🔧 Structured Errors & llms.txt');

test('StructuredApiError: creates error with details', () => {
  const err = new StructuredApiError({
    error: true,
    status: 400,
    message: 'Bad request',
    fix: ['Add the required parameter'],
    relatedTools: ['discover_tools']
  });
  assertEqual(err.name, 'StructuredApiError');
  assertEqual(err.details.status, 400);
  assert(err.details.fix.length > 0, 'Should have fix suggestions');
  assert(err.details.relatedTools.length > 0, 'Should have related tools');
});

test('StructuredApiError: is an instance of Error', () => {
  const err = new StructuredApiError({ message: 'test' });
  assert(err instanceof Error, 'Should be an Error');
  assert(err instanceof StructuredApiError, 'Should be a StructuredApiError');
});

test('llms.txt: file exists and has content', () => {
  const content = readFileSync(join(__dirname, '../src/llms.txt'), 'utf-8');
  assert(content.length > 500, 'llms.txt should have substantial content');
  assert(content.includes('GeoTap'), 'Should mention GeoTap');
  assert(content.includes('API Base URL'), 'Should have API base URL');
  assert(content.includes('FEMA'), 'Should mention FEMA');
  assert(content.includes('USGS'), 'Should mention USGS');
});

test('llms.txt: contains all major sections', () => {
  const content = readFileSync(join(__dirname, '../src/llms.txt'), 'utf-8');
  assert(content.includes('Quick Start'), 'Should have Quick Start');
  assert(content.includes('Authentication'), 'Should have Authentication');
  assert(content.includes('MCP Server'), 'Should have MCP Server section');
  assert(content.includes('Core Endpoints'), 'Should have Core Endpoints');
  assert(content.includes('Data Sources'), 'Should have Data Sources');
  assert(content.includes('Tips for AI Agents'), 'Should have AI tips');
});

test('llms.txt: contains lat/lng tip', () => {
  const content = readFileSync(join(__dirname, '../src/llms.txt'), 'utf-8');
  assert(content.includes('lat/lng') || content.includes('lat + lng'),
    'Should mention lat/lng shortcut');
});

test('llms.txt: mentions _summary field', () => {
  const content = readFileSync(join(__dirname, '../src/llms.txt'), 'utf-8');
  assert(content.includes('_summary'), 'Should mention _summary field');
});

// ════════════════════════════════════════════════════════════════════
// EDGE CASES & INTEGRATION
// ════════════════════════════════════════════════════════════════════

console.log('\n🧪 Edge Cases & Integration');

test('Full pipeline: cap + summary work together', () => {
  const bigResult = {
    layers: {
      flood_zones: {
        features: Array.from({ length: 80 }, (_, i) => ({
          type: 'Feature',
          properties: { id: i, zone: 'AE' }
        }))
      }
    }
  };

  const { data: capped } = capResponse('get_environmental_data_for_area', bigResult);
  const summary = generateSummary('get_environmental_data_for_area', {}, capped);

  assert(capped._pagination, 'Should have pagination from capping');
  assert(summary, 'Should have summary');
  assert(summary.includes('capped') || summary.includes('features'), 'Summary should reference feature data');
});

test('Full pipeline: lat/lng conversion + summary', () => {
  const params = { lat: 32.08, lng: -81.09, projectName: 'Test Site' };
  const converted = convertLatLng('generate_site_analysis', params);

  assert(converted.geometry, 'Should convert lat/lng');

  const summary = generateSummary('generate_site_analysis', params, { jobId: 'job-123' });
  assert(summary.includes('Test Site'), 'Summary should include project name');
  assert(summary.includes('job-123'), 'Summary should include job ID');
});

test('discoverTools: all categories have valid tool names', () => {
  const result = discoverTools('everything');
  // Just check structure is valid
  assert(result.allCategories.length > 10, 'Should have many categories');
  assert(typeof result.totalToolsAvailable === 'number');
});

test('capResponse: handles deeply nested structures', () => {
  const nested = {
    layers: {
      test: {
        features: Array.from({ length: 5 }, () => ({
          properties: {
            nested: { deep: { value: 'test' } }
          }
        }))
      }
    }
  };
  const { data, wasCapped } = capResponse('get_environmental_data_for_area', nested);
  assert(!wasCapped, 'Small nested data should not be capped');
  assertEqual(data.layers.test.features[0].properties.nested.deep.value, 'test');
});

test('generateSummary: check_api_status with services', () => {
  const summary = generateSummary('check_api_status', {}, {
    services: { fema: { healthy: true }, usgs: { healthy: true }, epa: { status: 'ok' } }
  });
  assert(summary.includes('3 services healthy'), 'Should count healthy services');
});

test('convertLatLng: all polygon tools produce valid GeoJSON', () => {
  const polygonTools = [
    'get_environmental_data_for_area',
    'get_environmental_summary',
    'find_water_features',
    'export_dem',
    'export_contours',
    'export_land_use',
    'export_satellite_imagery'
  ];

  for (const toolName of polygonTools) {
    const result = convertLatLng(toolName, { lat: 30, lng: -95 });
    assert(result.polygon, `${toolName}: Should have polygon`);
    assertEqual(result.polygon.type, 'Polygon', `${toolName}: Should be Polygon`);
    const ring = result.polygon.coordinates[0];
    assertEqual(ring.length, 5, `${toolName}: Should have closed ring (5 pts)`);
    assertEqual(ring[0][0], ring[4][0], `${toolName}: Ring should be closed`);
    assertEqual(ring[0][1], ring[4][1], `${toolName}: Ring should be closed`);
  }
});

test('convertLatLng: all point tools produce valid GeoJSON Point', () => {
  const pointTools = [
    'generate_site_analysis',
    'generate_constraints_report',
    'generate_developability_report',
    'export_data',
    'get_water_quality'
  ];

  for (const toolName of pointTools) {
    const paramName = toolName === 'get_water_quality' ? 'location' : 'geometry';
    const result = convertLatLng(toolName, { lat: 30, lng: -95 });
    assert(result[paramName], `${toolName}: Should have ${paramName}`);
    assertEqual(result[paramName].type, 'Point', `${toolName}: Should be Point`);
    assertEqual(result[paramName].coordinates[0], -95, `${toolName}: Lng first`);
    assertEqual(result[paramName].coordinates[1], 30, `${toolName}: Lat second`);
  }
});

// ════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\n❌ Failures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!\n');
  process.exit(0);
}
