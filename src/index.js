#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { callApi, StructuredApiError, requireApiKey } from './api.js';
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
- Rainfall: NOAA Atlas 14 precipitation frequency data (IDF curves, design storms)
- Land cover: NLCD 2021 classification (developed, forest, wetlands, etc.)
- Elevation: USGS 3DEP (min/max/mean elevation, relief)
- Infrastructure: hospitals, fire stations, schools, EMS, dams, levees, power plants, airports, railroads, bridges
- Ecology: species (GBIF), fish habitat, critical habitat, cropland, national forests, BLM lands, historic places
- Energy: solar potential, utility rates, EV charging stations
- Demographics: Census ACS (population, income, housing, poverty, vacancy rates)
- Protected lands (PAD-US), wild & scenic rivers, sole source aquifers

HOW TO PRESENT RESULTS:
The goal is a scannable engineering document, not a data dump. An engineer doing site due diligence needs to answer three questions fast:
1. What kills the project? (floodway, contamination, protected species)
2. What complicates permitting? (wetlands, impaired waters, high slopes, poor soils)
3. What's the baseline context? (rainfall IDF, seismic params, demographics, infrastructure)

CRITICAL FLAGS — scan results and lead with these if present:
- Any FEMA zone AE/AO/VE (SFHA): "Site intersects SFHA — Zone [X]" (CRITICAL)
- Any floodway: "Regulatory floodway — no-rise certification required" (CRITICAL)
- Superfund site nearby: "NPL Superfund site within search radius" (CRITICAL)
- Wetland count > 10: "High wetland density — Section 404 permitting likely" (HIGH)
- 303(d) impaired water (Category 5): "TMDL required, stricter discharge limits" (HIGH)
- Brownfields > 3: "Phase I ESA recommended" (MODERATE)
- Soils with HSG D: "Poorly draining soils — stormwater design impact" (MODERATE)

SECTION ORDER (skip sections with no data):
1. Site overview — address, coordinates, county, elevation (min/max/mean), land cover, area
2. FEMA flood zones — table with zone, subtype, SFHA status, risk level
3. Soils — one block per soil unit: HSG, drainage class, slope, flood frequency, limitations
4. Atlas 14 rainfall — IDF table (rows: 15min, 1hr, 6hr, 12hr, **24hr bold**, 3day; cols: 2yr, 5yr, 10yr, 25yr, 50yr, 100yr). Include Atlas 14 volume/version.
5. Natural hazard risk — NRI ratings by hazard type (overall, flooding, tornado, earthquake, etc.)
6. Wetlands — count, type breakdown, Section 404 permitting note
7. Water resources — streams (with distances), impaired waters (category), watershed HUC
8. Contamination — Superfund, brownfields (with distances/status), USTs, NPDES outfalls
9. Seismic & dams — ASCE 7-22 params (SDS, SD1, SDC, PGA), nearby dams with hazard rating
10. Infrastructure — hospitals, fire stations, schools, EMS counts with distances
11. Solar & energy — DNI, GHI, capacity factor, utility rates
12. Demographics — population, median income, vacancy rate (from Census ACS)

FORMATTING RULES:
- Use markdown tables for flood zones, rainfall IDF, brownfields, soils
- Bold the 24-hr row in rainfall tables — it's the most referenced for stormwater design
- For soils, always include HSG and drainage class — these drive CN calculations
- Include distances and cardinal directions for nearby features (e.g., "0.8 mi NW")
- When a source returned no data ("_noData"), mention it where relevant ("no Superfund sites" is positive)
- Cite source agencies (FEMA, NRCS, NOAA Atlas 14, EPA), not just "GeoTap"
- End with disclaimer: "Data sourced from US federal agencies via GeoTap. Verify critical findings against authoritative sources before making engineering or regulatory decisions."

IMPORTANT:
- All data from authoritative US federal sources. Always cite the source agency, not just "GeoTap."
- Data is for informational purposes. Remind users to verify for engineering/regulatory decisions.
- Coordinates must be within the United States (including territories).
- If a data source returns "_noData: true", it was queried but found nothing at that location — mention this where relevant (no contamination nearby is positive).
- If a data source returns "_error", note that the source was unavailable and the user should check back.`
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
        // API returns { success, results: [{ lat, lon, displayName, source }] }
        const match = geocodeResult?.results?.[0];
        if (!match?.lat || !match?.lon) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: true,
              message: `Could not geocode address: "${address}". Try a more specific address with city/state, or use lat/lng coordinates directly.`,
              suggestion: 'Example: { lat: 34.8779, lng: -82.3313 }',
            }, null, 2) }],
            isError: true
          };
        }
        siteGeometry = {
          type: 'Point',
          coordinates: [match.lon, match.lat]
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
  `Check the status of a data collection job and retrieve results. Poll every 10 seconds until status is "completed".

When complete, present results as a SCANNABLE ENGINEERING DOCUMENT — not a data dump. An engineer needs to answer: (1) What kills the project? (2) What complicates permitting? (3) What's the baseline context?

CRITICAL FLAGS — scan results FIRST and lead with these if present:
- FEMA Zone AE/AO/VE or SFHA=true → "Site intersects SFHA — Zone [X]" (CRITICAL)
- Floodway present → "Regulatory floodway — no-rise certification required" (CRITICAL)
- Superfund count > 0 → "NPL Superfund site within search radius" (CRITICAL)
- Wetland count > 10 → "High wetland density — Section 404 permitting likely" (HIGH)
- 303(d) impaired water → "TMDL required, stricter discharge limits" (HIGH)
- Brownfields > 3 → "Phase I ESA recommended" (MODERATE)
- Soils with HSG D → "Poorly draining soils — stormwater design impact" (MODERATE)

SECTION ORDER (skip sections with no data):
1. Site overview — address, coordinates, county, elevation range, land cover, area
2. FEMA flood zones — table: zone | subtype | SFHA | risk level
3. Soils — per unit: HSG, drainage class, slope, flood frequency, building/septic limitations
4. Atlas 14 rainfall — IDF table (rows: 15min, 1hr, 6hr, 12hr, **24hr**, 3day; cols: 2yr–100yr). **Bold the 24hr row.** Include Atlas 14 volume.
5. Natural hazard risk — NRI ratings by hazard type
6. Wetlands — count, type breakdown, Section 404 note
7. Water resources — streams with distances, impaired waters
8. Contamination — Superfund, brownfields (with distances/status), USTs, NPDES
9. Seismic & dams — ASCE 7-22 params (SDS, SD1, SDC), nearby dams with hazard rating
10. Infrastructure — hospitals, fire stations, schools, EMS counts
11. Demographics — population, median income, vacancy rate

FORMATTING:
- Use markdown tables for flood zones, rainfall IDF, soils, brownfields
- Cite source agencies (FEMA, NRCS, NOAA Atlas 14, EPA) not just "GeoTap"
- Include distances and bearings for nearby features (e.g., "0.8 mi NW")
- "_noData: true" means queried but nothing found — mention where relevant ("no Superfund sites" is positive)
- End with: "Data sourced from US federal agencies via GeoTap. Verify critical findings before engineering or regulatory decisions."`,
  {
    jobId: z.string().describe('Job ID returned from collect_site_data'),
  },
  async (params) => {
    try {
      const result = await callApi(`/site-analysis/data-collect/${encodeURIComponent(params.jobId)}`, 'GET', {});

      const response = { ...result };

      // Add presentation guidance when results are complete
      if (result.status === 'completed') {
        response._meta = {
          sources: '80+ US federal agencies (FEMA, USGS, NOAA, EPA, NRCS, USFWS, USACE, DOE, DOT, CDC, Census, and more)',
          retrievedAt: new Date().toISOString(),
          disclaimer: 'Data sourced from US federal agencies via GeoTap. Always verify critical data against authoritative sources before making engineering or regulatory decisions.',
        };
        response._presentationGuide = {
          instructions: 'Present as a scannable engineering document. Lead with critical flags, then structured sections. Follow the HOW TO PRESENT RESULTS instructions.',
          priorityOrder: [
            '1. Critical flags (floodway, SFHA, Superfund, high wetland density)',
            '2. FEMA flood zones (table: zone, subtype, SFHA, risk)',
            '3. Soils (HSG, drainage class, slope, limitations)',
            '4. Atlas 14 rainfall (IDF table — bold 24hr row)',
            '5. NRI hazard risk (badge grid by hazard type)',
            '6. Wetlands (count, types, Section 404 note)',
            '7. Water resources (streams, impaired waters with distances)',
            '8. Contamination (Superfund, brownfields, USTs with distances)',
            '9. Seismic & dams (ASCE 7-22 params, nearby dams)',
            '10. Infrastructure (hospitals, fire, schools, EMS counts)',
            '11. Solar/energy & demographics (collapsed/secondary)',
          ],
          tips: [
            'Lead with what kills or complicates the project — not context',
            'Use tables for flood zones, rainfall IDF, brownfields, soils',
            'Bold the 24-hr rainfall row — most referenced for stormwater design',
            'For soils, always show HSG and drainage class (drives CN calculation)',
            'Cite source agencies (FEMA, NRCS, NOAA Atlas 14, EPA)',
            '"No Superfund sites nearby" is positive — mention it',
          ]
        };
      } else {
        response._instructions = `Job status: ${result.status}. Poll again in 10 seconds until status is "completed".`;
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(response, null, 2) }]
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

// Require API key before starting
try {
  requireApiKey();
} catch (err) {
  console.error(`[geotap] ERROR: ${err.message}`);
  process.exit(1);
}

console.error(`[geotap] v3.0.0 — 2 tools (collect_site_data, get_results) + 1 meta-tool (get_llms_txt)`);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
