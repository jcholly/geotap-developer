#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { tools } from './tools.js';
import { callApi, StructuredApiError } from './api.js';
import { toolSources } from './sources.js';
import { capResponse } from './responseCap.js';
import { generateSummary } from './summaries.js';
import { convertLatLng } from './latLngHelper.js';
import { discoverTools } from './discoverTools.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: 'geotap',
  version: '1.3.0',
  description: 'Access 37 US federal environmental and infrastructure data sources. Query flood zones, wetlands, soils, rainfall, watersheds, water quality, endangered species, elevation, land use, and more for any location in the United States.',
  instructions: `You have access to GeoTap, which provides real-time data from 37 US federal agencies (FEMA, USGS, NOAA, EPA, NRCS, USFWS, USACE, and more).

START HERE — CORE TOOLS (use these for 90% of queries):
1. query_address — Geocode + environmental lookup in ONE call. Always start here when user gives an address.
2. identify_features_at_point — Same as above but when you already have lat/lng coordinates.
3. get_rainfall_data — NOAA Atlas 14 precipitation data for any US location.
4. get_environmental_summary — Quick feature counts for an area (no geometry, just numbers).
5. discover_tools — Don't know which tool to use? Describe your question and get the best matches.

NEW IN v1.3: SMART FEATURES:
- Every response includes a _summary field with a plain-English description.
- POST endpoints accept flat lat/lng parameters — no need to construct GeoJSON.
- Responses are automatically capped to prevent context window overflow.
- Structured error messages tell you exactly how to fix issues.
- Use discover_tools to find the right tool from 68+ options.

RESPONSE SIZE MANAGEMENT:
- query_address and identify_features_at_point always return <5KB (no geometry, just properties + interpretations).
- For all other spatial tools, ALWAYS set geometry="none" unless the user specifically needs coordinates.
- Always specify layers (e.g., layers="flood_zones,wetlands") instead of querying all 19 layers.
- Responses are now auto-capped at 50 features per layer with summaries.

LAT/LNG SHORTCUT:
- POST tools that normally require GeoJSON now accept { lat, lng } instead.
- Example: generate_site_analysis({ lat: 32.08, lng: -81.09 }) — auto-converts to GeoJSON Point.
- For polygon tools, lat/lng creates a ~0.5km bounding box around the point.

COMMON WORKFLOWS:
- "What flood zone is this address in?" → query_address (one call, done)
- "Is this a good place to build?" → query_address → get_rainfall_data → get_environmental_summary
- "Environmental due diligence" → query_address (covers flood, wetlands, soils, contamination, habitat)
- "What's the 100-year rainfall?" → get_rainfall_data
- "Hydrology analysis" → watershed delineate + curve numbers + rainfall + peak flow
- "Export data" → query layers, then export tool for GeoJSON/Shapefile/CSV/KML

IMPORTANT NOTES:
- All data comes from authoritative federal sources. Always mention the source agency.
- Responses include _summary with plain-English summaries — use these in your answers.
- Responses include _interpretation fields with per-feature context — reference these too.
- This data is for informational purposes. Remind users to verify critical data for engineering/regulatory decisions.
- Coordinates must be within the United States (including territories).
- Some tools (watershed delineation, hydrology) can take 10-60 seconds.
- Layer names use underscores: flood_zones, wetlands, dem_elevation, building_footprints, etc.`
});

// ── Register discover_tools meta-tool ───────────────────────────────

server.tool(
  'discover_tools',
  'Find the best GeoTap tools for your question. Describe what you need in plain English and get back the 3-5 most relevant tools with their parameters. Use this when you have 68 tools and aren\'t sure which one to pick.',
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

// ── Register get_llms_txt tool ──────────────────────────────────────

server.tool(
  'get_llms_txt',
  'Get the GeoTap API discovery document (llms.txt). Returns a structured description of all API endpoints, data sources, and usage tips optimized for AI agents. Use this to understand the full API before making queries.',
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

// ── Register all API tools ──────────────────────────────────────────

for (const tool of tools) {
  server.tool(
    tool.name,
    tool.description,
    tool.parameters,
    async (params) => {
      try {
        // Improvement #3: Convert lat/lng to GeoJSON if needed
        const convertedParams = convertLatLng(tool.name, params);

        // Strip internal fields before sending to API
        const apiParams = { ...convertedParams };
        delete apiParams._latLngConverted;

        const rawResult = await callApi(tool.endpoint, tool.method, apiParams);

        // Improvement #1: Cap response size
        const { data: cappedResult, wasCapped, capInfo } = capResponse(tool.name, rawResult);

        // Improvement #2: Generate natural language summary
        const summary = generateSummary(tool.name, params, cappedResult);

        // Enrich response with source attribution, summary, and metadata
        const sources = toolSources[tool.name] || [];
        const enriched = {
          ...(summary ? { _summary: summary } : {}),
          ...cappedResult,
          ...(convertedParams._latLngConverted ? { _latLngConverted: convertedParams._latLngConverted } : {}),
          ...(wasCapped ? { _responseCapped: capInfo } : {}),
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
        // Improvement #5: Structured error messages
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
            fix: ['Check that all required parameters are provided and valid.', 'Use discover_tools to find the right tool for your question.'],
            relatedTools: ['discover_tools', 'check_api_status']
          }, null, 2) }],
          isError: true
        };
      }
    }
  );
}

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
