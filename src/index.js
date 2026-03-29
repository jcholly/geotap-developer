#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { callApi, StructuredApiError } from './api.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = new McpServer({
  name: 'geotap',
  version: '3.0.0',
  description: 'Collect comprehensive environmental and infrastructure data from 80+ US federal sources for any site in the United States. Returns raw data from FEMA, USGS, NOAA, EPA, NRCS, USFWS, USACE, DOE, DOT, CDC, Census, and more.',
  instructions: `You have access to GeoTap, which collects data from 80+ US federal agencies for any site in the United States.

HOW IT WORKS:
1. Call collect_site_data with a site location (address, coordinates, or GeoJSON geometry)
2. You get back a jobId — the backend queries all 80+ federal sources (takes 60-120 seconds)
3. Poll get_results every 10 seconds with the jobId until status is "completed"
4. When complete, you receive ALL available data for that site — present it to the user

DATA INCLUDES:
- Flood zones (FEMA NFHL), wetlands (NWI), soils (NRCS SSURGO), geology
- Contamination: Superfund, brownfields, USTs, EPA-regulated facilities (RCRA, GHG, FRS)
- Water: streams, watershed, water quality impairments (ATTAINS), NPDES outfalls, groundwater
- Hazards: seismic design (ASCE 7-22), earthquakes, wildfires, landslides, coastal vulnerability, NRI
- Rainfall: NOAA Atlas 14 precipitation frequency data
- Infrastructure: hospitals, fire stations, schools, EMS, dams, levees, power plants, airports, railroads, bridges
- Ecology: species (GBIF), fish habitat, critical habitat, cropland, national forests, BLM lands, historic places
- Energy: solar potential, utility rates, EV charging stations
- Demographics: Census ACS (population, income, housing, poverty)
- Protected lands (PAD-US), wild & scenic rivers, sole source aquifers

IMPORTANT:
- All data from authoritative US federal sources. Always cite the source agency.
- Data is for informational purposes. Remind users to verify for engineering/regulatory decisions.
- Coordinates must be within the United States (including territories).
- If a data source returns "_noData: true", it was queried but found nothing at that location.`
});

// ── Tool: collect_site_data ──────────────────────────────────────────

server.tool(
  'collect_site_data',
  `Collect comprehensive environmental data from ALL 80+ federal data sources for a site. Accepts an address, lat/lng coordinates, or a GeoJSON geometry (Point or Polygon). Returns a jobId — poll with get_results until complete (60-120 seconds).

Data returned covers: flood zones, wetlands, soils, geology, contamination sites, water quality, seismic risk, rainfall, infrastructure, ecology, energy, demographics, and much more.`,
  {
    address: z.string().optional().describe('US street address (e.g., "123 Main St, Houston TX"). If provided, the site is geocoded automatically. Use this OR lat/lng OR geometry.'),
    lat: z.number().optional().describe('Latitude of the site (e.g., 34.8441). Use with lng.'),
    lng: z.number().optional().describe('Longitude of the site (e.g., -82.4010). Use with lat.'),
    geometry: z.any().optional().describe('GeoJSON geometry (Point or Polygon). For advanced use — most users should use address or lat/lng instead.'),
    bufferAcres: z.number().optional().describe('Site area in acres when using a point location. Creates a circular buffer. Default: 1 acre. Range: 0.1–640.'),
    searchRadiusMiles: z.number().optional().describe('How far to search for nearby features (contamination, infrastructure, etc.). Default: 3 miles. Range: 0.5–10.'),
  },
  async (params) => {
    try {
      const { address, lat, lng, geometry, bufferAcres, searchRadiusMiles } = params;

      // Build the geometry from whatever input was provided
      let siteGeometry = geometry;

      if (address && !siteGeometry) {
        // Geocode the address first
        const geocodeResult = await callApi('/geocode', 'GET', { address });
        if (!geocodeResult?.lat || !geocodeResult?.lng) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: true,
              message: `Could not geocode address: "${address}". Try a more specific address or use lat/lng coordinates.`,
            }, null, 2) }],
            isError: true
          };
        }
        siteGeometry = {
          type: 'Point',
          coordinates: [geocodeResult.lng, geocodeResult.lat]
        };
      } else if (lat != null && lng != null && !siteGeometry) {
        siteGeometry = {
          type: 'Point',
          coordinates: [lng, lat]
        };
      }

      if (!siteGeometry) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: true,
            message: 'Provide a site location: address, lat/lng, or geometry.',
            examples: [
              { address: '123 Main St, Houston TX' },
              { lat: 34.8441, lng: -82.4010 },
              { geometry: { type: 'Point', coordinates: [-82.4010, 34.8441] } }
            ]
          }, null, 2) }],
          isError: true
        };
      }

      // Start the data collection job
      const body = { geometry: siteGeometry };
      if (bufferAcres != null) body.bufferAcres = bufferAcres;
      if (searchRadiusMiles != null) body.searchRadiusMiles = searchRadiusMiles;

      const result = await callApi('/site-analysis/data-collect', 'POST', body);

      return {
        content: [{ type: 'text', text: JSON.stringify({
          ...result,
          _instructions: 'Job started. Poll get_results with this jobId every 10 seconds until status is "completed". Data collection queries 80+ federal sources and takes 60-120 seconds.',
        }, null, 2) }]
      };
    } catch (error) {
      if (error instanceof StructuredApiError) {
        return {
          content: [{ type: 'text', text: JSON.stringify(error.details, null, 2) }],
          isError: true
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: true, message: error.message }, null, 2) }],
        isError: true
      };
    }
  }
);

// ── Tool: get_results ────────────────────────────────────────────────

server.tool(
  'get_results',
  `Check the status of a data collection job and retrieve results. Poll every 10 seconds until status is "completed". When complete, returns the full data summary from all 80+ federal sources.`,
  {
    jobId: z.string().describe('Job ID returned from collect_site_data'),
  },
  async (params) => {
    try {
      const result = await callApi(`/site-analysis/data-collect/${encodeURIComponent(params.jobId)}`, 'GET', {});

      return {
        content: [{ type: 'text', text: JSON.stringify({
          ...result,
          _meta: {
            sources: '80+ US federal agencies (FEMA, USGS, NOAA, EPA, NRCS, USFWS, USACE, DOE, DOT, CDC, Census, and more)',
            retrievedAt: new Date().toISOString(),
            disclaimer: 'Data sourced from US federal agencies via GeoTap. Always verify critical data against authoritative sources before making engineering or regulatory decisions.',
          }
        }, null, 2) }]
      };
    } catch (error) {
      if (error instanceof StructuredApiError) {
        return {
          content: [{ type: 'text', text: JSON.stringify(error.details, null, 2) }],
          isError: true
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: true, message: error.message }, null, 2) }],
        isError: true
      };
    }
  }
);

// ── Tool: get_llms_txt (meta) ────────────────────────────────────────

server.tool(
  'get_llms_txt',
  'Get the GeoTap API discovery document. Returns a structured description of all data sources and capabilities.',
  {},
  async () => {
    try {
      const content = readFileSync(join(__dirname, 'llms.txt'), 'utf-8');
      return { content: [{ type: 'text', text: content }] };
    } catch {
      return {
        content: [{ type: 'text', text: 'llms.txt not found. Visit https://geotapdata.com/llms.txt for documentation.' }],
        isError: true
      };
    }
  }
);

console.error(`[geotap] v3.0.0 — 2 tools (collect_site_data, get_results) + 1 meta-tool (get_llms_txt)`);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
