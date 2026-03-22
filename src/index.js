#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { tools } from './tools.js';
import { consolidatedTools } from './consolidatedTools.js';
import { callApi, StructuredApiError } from './api.js';
import { toolSources } from './sources.js';
import { capResponse } from './responseCap.js';
import { generateSummary } from './summaries.js';
import { convertLatLng } from './latLngHelper.js';
import { normalizeParams } from './paramNormalize.js';
import { discoverTools } from './discoverTools.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const useLegacyTools = process.env.GEOTAP_LEGACY_TOOLS === 'true';

// Build lookup map for legacy tools (used by both modes)
const legacyToolMap = new Map(tools.map(t => [t.name, t]));

const server = new McpServer({
  name: 'geotap',
  version: '2.0.0',
  description: 'Access US federal environmental and infrastructure data layers from 64+ agencies. Query flood zones, wetlands, soils, rainfall, watersheds, water quality, endangered species, elevation, land use, hazards, energy, infrastructure, transportation, and more for any location in the United States.',
  instructions: useLegacyTools
    ? `You have access to GeoTap with 85 individual tools. Use discover_tools to find the right one.`
    : `You have access to GeoTap, which provides real-time data from 37 US federal agencies (FEMA, USGS, NOAA, EPA, NRCS, USFWS, USACE, and more).

TOOL OVERVIEW (16 tools + 2 meta-tools):
1. query_location — Start here. Query environmental data by address, coordinates, bbox, polygon, or radius.
2. get_rainfall — NOAA Atlas 14 precipitation, IDF curves, hyetographs, climate projections.
3. get_watershed — Watershed delineation, flow statistics, flowlines, HUC boundaries, FIRM panels.
4. get_hydrology — Curve numbers, runoff calculations, time of concentration, peak discharge.
5. get_water_quality — EPA water quality impairments, 303(d) listings, receiving waters.
6. get_elevation — USGS 3DEP elevation, contours, DEM export, land use, satellite imagery.
7. analyze_gage — USGS stream gage analysis: flood frequency, flow duration, storm events.
8. estimate_ungaged — Flow estimation at ungaged sites: regression, similarity, transfer methods.
9. generate_report — Site analysis, constraints, and developability reports with scoring.
10. export_data — Export layers to GeoJSON, Shapefile, CSV.
11. find_stations — Find monitoring stations (USGS, NOAA) and analyze waterway permit requirements.
12. check_status — API health and federal data source connectivity.
13. get_hazards — FEMA risk index, seismic design values, wildfires, landslides, coastal vulnerability, flood insurance claims, social vulnerability.
14. get_energy — Solar resource, PVWatts production estimates, utility rates, EV charging stations.
15. get_infrastructure — Hospitals, fire stations, schools, power plants, airports, railroad crossings, bridges, historic places.
16. get_ecology — Species occurrences, essential fish habitat.

Every tool uses an "action" parameter to select the specific operation. Read the tool description to see available actions.

COORDINATE FLEXIBILITY:
- All tools accept lat/lng, lat/lon, or latitude/longitude — they are automatically normalized.
- POST tools accept flat lat/lng instead of GeoJSON — auto-converted to the correct format.

RESPONSE SIZE:
- geometry defaults to "none" for spatial queries (prevents context overflow).
- Responses auto-capped at 40KB (~10K tokens). Use specific layers to get smaller responses.
- Always specify layers (e.g., layers="flood_zones,wetlands") instead of querying all layers.

COMMON WORKFLOWS:
- "What flood zone is this address in?" → query_location(action: "address", address: "...")
- "What's the 100-year rainfall?" → get_rainfall(action: "atlas14", lat, lng)
- "Delineate the watershed" → get_watershed(action: "delineate", lat, lng)
- "Environmental site analysis" → generate_report(action: "site_analysis", geometry: ...)
- "What permits do I need?" → find_stations(action: "find_water_features") → find_stations(action: "analyze_permits")

IMPORTANT:
- All data from authoritative US federal sources. Always cite the source agency.
- Responses include _summary with plain-English descriptions — use these in answers.
- Data is for informational purposes. Remind users to verify for engineering/regulatory decisions.
- Coordinates must be within the United States (including territories).`
});

// ── Shared tool call handler ────────────────────────────────────────

/**
 * Handle a tool call through the standard pipeline:
 * normalize → convertLatLng → callApi → capResponse → generateSummary → checkDataQuality → enrich
 *
 * @param {string} legacyToolName - The original tool name (for routing summaries/sources)
 * @param {string} endpoint - API endpoint path
 * @param {string} method - HTTP method (GET/POST)
 * @param {object} params - Parameters from the LLM (after action extraction)
 * @returns {object} MCP tool response
 */
async function handleToolCall(legacyToolName, endpoint, method, params) {
  try {
    // Fix #1: Normalize coordinate params to what backend expects
    const normalized = normalizeParams(legacyToolName, params);

    // Convert lat/lng to GeoJSON if needed (existing feature)
    const convertedParams = convertLatLng(legacyToolName, normalized);

    // Strip internal fields before sending to API
    const apiParams = { ...convertedParams };
    delete apiParams._latLngConverted;

    const rawResult = await callApi(endpoint, method, apiParams);

    // Cap response size
    const { data: cappedResult, wasCapped, capInfo } = capResponse(legacyToolName, rawResult);

    // Generate natural language summary
    const summary = generateSummary(legacyToolName, params, cappedResult);

    // Fix #5: Check data quality and add warnings
    const dataQuality = checkDataQuality(legacyToolName, cappedResult);

    // Enrich response with source attribution, summary, and metadata
    const sources = toolSources[legacyToolName] || [];
    const enriched = {
      ...(summary ? { _summary: summary } : {}),
      ...cappedResult,
      ...(convertedParams._latLngConverted ? { _latLngConverted: convertedParams._latLngConverted } : {}),
      ...(wasCapped ? { _responseCapped: capInfo } : {}),
      ...(dataQuality ? { _dataQuality: dataQuality } : {}),
      _meta: {
        sources,
        retrievedAt: new Date().toISOString(),
        disclaimer: 'Data sourced from US federal agencies via GeoTap. Always verify critical data against authoritative sources before making engineering or regulatory decisions.',
      }
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }]
    };
  } catch (error) {
    if (error instanceof StructuredApiError) {
      return {
        content: [{ type: 'text', text: JSON.stringify(error.details, null, 2) }],
        isError: true
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({
        error: true,
        message: error.message,
        fix: ['Check that all required parameters are provided and valid.', 'Use discover_tools or check the tool description for available actions.'],
        relatedTools: ['discover_tools', 'check_status']
      }, null, 2) }],
      isError: true
    };
  }
}

// ── Fix #5: Data quality warnings ───────────────────────────────────

/**
 * Check API response for signs of degraded or incomplete data.
 * Returns a _dataQuality object with warnings, or null if no issues detected.
 */
function checkDataQuality(toolName, result) {
  if (!result || typeof result !== 'object') return null;

  const warnings = [];

  // Check for empty layer results in spatial queries
  if (result.layers && typeof result.layers === 'object') {
    const emptyLayers = [];
    const populatedLayers = [];
    for (const [name, data] of Object.entries(result.layers)) {
      if (data?.features?.length === 0 || data?.featureCount === 0) {
        emptyLayers.push(name);
      } else if (data?.features?.length > 0) {
        populatedLayers.push(name);
      }
    }
    if (emptyLayers.length > 0 && populatedLayers.length > 0) {
      // Only warn if some layers returned data but others didn't
      // (if ALL are empty, that's a valid "nothing here" result)
      warnings.push({
        type: 'partial_results',
        message: `${emptyLayers.length} layer(s) returned no features: ${emptyLayers.join(', ')}. This may be expected (no features at this location) or may indicate a data gap.`,
        layers: emptyLayers,
      });
    }
  }

  // Check for empty watershed geometry (the 82% failure pattern)
  if (toolName === 'delineate_watershed' || toolName === 'get_watershed') {
    const geom = result.data?.geometry || result.geometry || result.boundary?.geometry;
    if (geom && geom.coordinates && geom.coordinates.length === 0) {
      warnings.push({
        type: 'empty_geometry',
        message: 'Watershed delineation returned empty geometry. USGS StreamStats may not have coverage for this location. Try a nearby point on a mapped stream.',
        severity: 'error',
      });
    }
    if (result.data?.characteristics?.drainageArea === null || result.data?.characteristics?.drainageArea === undefined) {
      if (result.data?.characteristics) {
        warnings.push({
          type: 'missing_field',
          message: 'Drainage area not returned by StreamStats. This basin characteristic may not be available for this region.',
          field: 'drainageArea',
        });
      }
    }
  }

  // Check for null key fields in gage data
  if (toolName.startsWith('get_gage') || toolName.startsWith('get_flood') || toolName.startsWith('get_flow') || toolName.startsWith('get_storm')) {
    if (result.drainageArea === null || result.drainageArea === undefined) {
      if (result.siteName || result.siteId) {
        warnings.push({
          type: 'missing_field',
          message: 'Drainage area is null for this gage. USGS NWIS may not have this metadata. Cross-reference with StreamStats if drainage area is needed.',
          field: 'drainageArea',
        });
      }
    }
  }

  // Check for stale NLCD data
  if (toolName === 'export_land_use' || toolName === 'analyze_curve_numbers') {
    warnings.push({
      type: 'data_currency',
      message: 'NLCD land cover data is from 2021 (latest available). For rapidly developing areas, ground-truth current conditions before relying on land use classifications.',
      severity: 'info',
    });
  }

  // Check for Atlas 14 metadata issues (Ohio River Basin bug)
  if (toolName === 'get_rainfall_data' || toolName === 'get_idf_curves') {
    const loc = result.location || result.metadata?.location;
    if (loc?.region && /ohio\s*river\s*basin/i.test(loc.region)) {
      // Check if the actual coordinates suggest a different region
      const lat = result.metadata?.lat || result.lat;
      if (lat && lat < 36) {
        warnings.push({
          type: 'metadata_mismatch',
          message: 'NOAA Atlas 14 reports "Ohio River Basin" as the region, but the coordinates may be in a different region. The rainfall data values are still correct — the region label is a known NOAA metadata issue for some locations.',
          severity: 'info',
        });
      }
    }
  }

  return warnings.length > 0 ? { warnings, totalWarnings: warnings.length } : null;
}

// ── Register meta-tools ─────────────────────────────────────────────

server.tool(
  'discover_tools',
  useLegacyTools
    ? 'Find the best GeoTap tools for your question. Describe what you need in plain English and get back the 3-5 most relevant tools with their parameters.'
    : 'Find the best GeoTap tool and action for your question. Describe what you need in plain English. Helpful when you\'re unsure which tool or action to use.',
  {
    question: z.string().describe('Natural language description of what you want to do (e.g., "What flood zone is this property in?" or "I need rainfall data for stormwater design")'),
    maxResults: z.number().optional().describe('Maximum tools to return (default: 5)')
  },
  async (params) => {
    const result = discoverTools(params.question, params.maxResults || 5);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  }
);

server.tool(
  'get_llms_txt',
  'Get the GeoTap API discovery document (llms.txt). Returns a structured description of all API endpoints, data sources, and usage tips optimized for AI agents.',
  {},
  async () => {
    try {
      const content = readFileSync(join(__dirname, 'llms.txt'), 'utf-8');
      return { content: [{ type: 'text', text: content }] };
    } catch {
      return {
        content: [{ type: 'text', text: 'llms.txt not found. Visit https://geotapdata.com/llms.txt for API documentation.' }],
        isError: true
      };
    }
  }
);

// ── Register tools based on mode ────────────────────────────────────

if (useLegacyTools) {
  // Legacy mode: register all 85 individual tools (for existing consumers)
  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.parameters,
      async (params) => handleToolCall(tool.name, tool.endpoint, tool.method, params)
    );
  }
  console.error(`[geotap] Legacy mode: registered ${tools.length} individual tools`);
} else {
  // Default: register 12 consolidated tools
  for (const ctool of consolidatedTools) {
    server.tool(
      ctool.name,
      ctool.description,
      ctool.parameters,
      async (params) => {
        const { action, ...restParams } = params;

        // Resolve consolidated action → legacy tool
        const legacyName = ctool._actionMap[action];
        if (!legacyName) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: true,
              message: `Unknown action "${action}" for tool "${ctool.name}".`,
              validActions: Object.keys(ctool._actionMap),
              fix: [`Use one of: ${Object.keys(ctool._actionMap).join(', ')}`],
            }, null, 2) }],
            isError: true
          };
        }

        const legacyTool = legacyToolMap.get(legacyName);
        if (!legacyTool) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: true,
              message: `Internal routing error: legacy tool "${legacyName}" not found.`,
            }, null, 2) }],
            isError: true
          };
        }

        return handleToolCall(legacyName, legacyTool.endpoint, legacyTool.method, restParams);
      }
    );
  }
  console.error(`[geotap] Consolidated mode: registered ${consolidatedTools.length} tools (set GEOTAP_LEGACY_TOOLS=true for 85 individual tools)`);
}

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
