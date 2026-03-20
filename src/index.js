#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { tools } from './tools.js';
import { callApi } from './api.js';
import { toolSources } from './sources.js';

const server = new McpServer({
  name: 'geotap',
  version: '1.1.0',
  description: 'Access 28+ US federal environmental and infrastructure data sources. Query flood zones, wetlands, soils, rainfall, watersheds, water quality, endangered species, elevation, land use, and more for any location in the United States.',
  instructions: `You have access to GeoTap, which provides real-time data from 28+ US federal agencies (FEMA, USGS, NOAA, EPA, NRCS, USFWS, USACE, and more).

HOW TO USE THESE TOOLS:
- For any US location question, start with geocode_address if the user gives an address (not coordinates).
- For "what flood zone / soil type / wetland is at this location?" use identify_features_at_point — it returns only properties (no geometry), so responses are tiny and fast.
- For "what's near this location?" use get_environmental_data_near_point with geometry=none to avoid large responses.
- Most tools accept lat/lon (or lat/lng). Use WGS84 decimal degrees.
- Use the geometry parameter ("none", "simplified", "full") to control response size. Default is "full" which includes all coordinates. Use "none" when you only need properties.
- Combine multiple tools to build a complete picture. For example, to assess a site:
  1. geocode_address → get coordinates
  2. identify_features_at_point → flood zone, soil type, wetlands, contamination at the exact point
  3. get_rainfall_atlas14 → NOAA precipitation data
  4. get_stations_near → nearby USGS/NOAA monitoring stations
  5. get_water_quality_impairments → EPA impaired waterways

COMMON WORKFLOWS:
- "Is this a good place to build?" → flood zones + wetlands + soils + constraints
- "What's the flood risk?" → flood zones + rainfall + nearby stream gauges
- "Environmental due diligence" → flood zones + wetlands + contamination + critical habitat + water quality
- "Hydrology analysis" → watershed delineate + curve numbers + rainfall + peak flow
- "Export data" → query the layers you need, then use the export tool for GeoJSON/Shapefile/CSV/KML

IMPORTANT NOTES:
- All data comes from authoritative federal sources. Always mention the source agency when presenting results.
- This data is for informational purposes. Remind users to verify critical data before making engineering or regulatory decisions.
- Coordinates must be within the United States (including territories).
- Some tools (watershed delineation, hydrology) can take 10-60 seconds for complex areas.
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
