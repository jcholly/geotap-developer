#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { tools } from './tools.js';
import { callApi } from './api.js';
import { toolSources } from './sources.js';

const server = new McpServer({
  name: 'geotap',
  version: '1.2.0',
  description: 'Access 28+ US federal environmental and infrastructure data sources. Query flood zones, wetlands, soils, rainfall, watersheds, water quality, endangered species, elevation, land use, and more for any location in the United States.',
  instructions: `You have access to GeoTap, which provides real-time data from 28+ US federal agencies (FEMA, USGS, NOAA, EPA, NRCS, USFWS, USACE, and more).

START HERE — CORE TOOLS (use these for 90% of queries):
1. query_address — Geocode + environmental lookup in ONE call. Always start here when user gives an address.
2. identify_features_at_point — Same as above but when you already have lat/lng coordinates.
3. get_rainfall_data — NOAA Atlas 14 precipitation data for any US location.
4. get_environmental_summary — Quick feature counts for an area (no geometry, just numbers).
5. geocode_address — Convert address to coordinates (only needed if query_address doesn't cover your use case).

These 5 tools handle most questions. Use specialized tools only when these don't cover the request.

RESPONSE SIZE MANAGEMENT:
- query_address and identify_features_at_point always return <5KB (no geometry, just properties + interpretations).
- For all other spatial tools, ALWAYS set geometry="none" unless the user specifically needs coordinates.
- Always specify layers (e.g., layers="flood_zones,wetlands") instead of querying all 19 layers.
- In urban areas, full-geometry responses can exceed 1MB. Geometry="none" reduces this to <10KB.

COMMON WORKFLOWS:
- "What flood zone is this address in?" → query_address (one call, done)
- "Is this a good place to build?" → query_address → get_rainfall_data → get_environmental_summary
- "Environmental due diligence" → query_address (covers flood, wetlands, soils, contamination, habitat)
- "What's the 100-year rainfall?" → get_rainfall_data
- "Hydrology analysis" → watershed delineate + curve numbers + rainfall + peak flow
- "Export data" → query layers, then export tool for GeoJSON/Shapefile/CSV/KML

IMPORTANT NOTES:
- All data comes from authoritative federal sources. Always mention the source agency.
- Responses include _interpretation fields with plain-English summaries — use these in your answers.
- This data is for informational purposes. Remind users to verify critical data for engineering/regulatory decisions.
- Coordinates must be within the United States (including territories).
- Some tools (watershed delineation, hydrology) can take 10-60 seconds.
- Layer names use underscores: flood_zones, wetlands, dem_elevation, building_footprints, etc.`
});

// Register all tools
for (const tool of tools) {
  server.tool(
    tool.name,
    tool.description,
    tool.parameters,
    async (params) => {
      try {
        const result = await callApi(tool.endpoint, tool.method, params);

        // Enrich response with source attribution and data freshness
        const sources = toolSources[tool.name] || [];
        const enriched = {
          ...result,
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
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
