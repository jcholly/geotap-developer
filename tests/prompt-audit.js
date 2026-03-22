#!/usr/bin/env node
/**
 * Prompt Audit — test every question from the developers page against discover_tools
 * and verify tool routing for the consolidated v2.0 MCP server.
 */

import { discoverTools } from '../src/discoverTools.js';
import { consolidatedTools } from '../src/consolidatedTools.js';

// Build reverse map: legacy tool name → consolidated tool + action
const reverseMap = new Map();
for (const ctool of consolidatedTools) {
  for (const [action, legacyName] of Object.entries(ctool._actionMap)) {
    reverseMap.set(legacyName, { tool: ctool.name, action });
  }
}

// All prompts from the developers page
const PROMPT_CATEGORIES = [
  {
    category: 'Flood Risk & FEMA',
    prompts: [
      'What flood zone is 123 Main St, Houston TX in?',
      'Is this property in a floodway or just a flood zone?',
      'What FEMA flood zones are near 30.27, -97.74?',
      "What's the base flood elevation at 123 Oak Ave, Tampa FL?",
    ],
    expectedTools: ['query_location', 'query_location', 'query_location', 'query_location'],
    expectedActions: ['address', 'address', 'nearby', 'address'],
  },
  {
    category: 'Rainfall & Hydrology',
    prompts: [
      "What's the 100-year, 24-hour rainfall in Austin, TX?",
      'Get Atlas 14 precipitation data for my site at 35.2, -80.8',
      'Calculate the curve number for this watershed',
      "What's the time of concentration for a 50-acre drainage area?",
      'Calculate peak discharge for a 25-year storm using the SCS method',
    ],
    expectedTools: ['get_rainfall', 'get_rainfall', 'get_hydrology', 'get_hydrology', 'get_hydrology'],
    expectedActions: ['atlas14', 'atlas14', 'analyze_cn', 'analyze', 'analyze'],
  },
  {
    category: 'Wetlands & Water',
    prompts: [
      'Are there any wetlands within 500ft of this property?',
      'What type of wetlands are at 29.95, -90.07?',
      'Is this stream listed as impaired under the Clean Water Act?',
      'What are the water quality issues near 40.7, -74.0?',
      'Find monitoring stations within 10 miles of Philadelphia',
    ],
    expectedTools: ['query_location', 'query_location', 'get_water_quality', 'get_water_quality', 'find_stations'],
    expectedActions: ['nearby', 'point', 'assessment', 'assessment', 'search_area'],
  },
  {
    category: 'Soils & Terrain',
    prompts: [
      'What soil type is at this location and does it drain well?',
      'Is the soil hydric at 33.45, -84.39?',
      "What soil type and drainage class is at my project site?",
      "What's the elevation and slope at 38.9, -77.04?",
    ],
    expectedTools: ['query_location', 'query_location', 'query_location', 'get_elevation'],
    expectedActions: ['point', 'point', 'point', 'stats'],
  },
  {
    category: 'Environmental Contamination',
    prompts: [
      'Are there any Superfund sites near 40.7, -74.0?',
      'Check for brownfields within 1 mile of this address',
      'Any underground storage tanks near my property?',
      'Are there any contamination sites or storage tanks near my property?',
    ],
    expectedTools: ['query_location', 'query_location', 'query_location', 'query_location'],
    expectedActions: ['nearby', 'nearby', 'nearby', 'nearby'],
  },
  {
    category: 'Watershed & Site Analysis',
    prompts: [
      'Delineate the watershed from this pour point',
      'What are the basin characteristics for this watershed?',
      'Run a full site developability assessment for this parcel',
      'What environmental constraints exist at this property?',
      'Check if this site has critical habitat or protected lands',
    ],
    expectedTools: ['get_watershed', 'get_watershed', 'generate_report', 'generate_report', 'query_location'],
    expectedActions: ['delineate', 'characteristics', 'site_analysis', 'constraints', 'address'],
  },
  {
    category: 'Stream Gage Analysis',
    prompts: [
      'Run a flood frequency analysis on USGS gage 08158000',
      "What's the flow duration curve for this stream gage?",
      'Find storm events above 1000 cfs at this gage in the last 5 years',
      'What are the published USGS statistics for gage 01646500?',
    ],
    expectedTools: ['analyze_gage', 'analyze_gage', 'analyze_gage', 'analyze_gage'],
    expectedActions: ['flood_frequency', 'flow_duration', 'storm_events', 'published_stats'],
  },
  {
    category: 'Ungaged Flow Estimation',
    prompts: [
      'Estimate flood flows at this ungaged site using regional regression',
      'Find similar gauged watersheds to compare against my site',
      'Recommend an index gage for transferring flow stats to my ungaged site',
    ],
    expectedTools: ['estimate_ungaged', 'estimate_ungaged', 'estimate_ungaged'],
    expectedActions: ['flood_frequency', 'find_similar', 'recommend_index'],
  },
  {
    category: 'Data Export',
    prompts: [
      'Export flood zones as a shapefile for this area',
      'Download the soil data as GeoJSON for this polygon',
      'Export wetlands data as CSV for my project area',
      'Export all environmental layers as KML for Google Earth',
    ],
    expectedTools: ['export_data', 'export_data', 'export_data', 'export_data'],
    expectedActions: ['export', 'export', 'export', 'export'],
  },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  PROMPT AUDIT — Developers Page Questions vs MCP v2.0');
console.log('═══════════════════════════════════════════════════════════════\n');

let totalQuestions = 0;
let discoveryHits = 0;
let discoveryMisses = 0;
let routingCorrect = 0;
let routingWrong = 0;
const issues = [];

for (const cat of PROMPT_CATEGORIES) {
  console.log(`\n▸ ${cat.category}`);
  console.log('─'.repeat(60));

  for (let i = 0; i < cat.prompts.length; i++) {
    totalQuestions++;
    const prompt = cat.prompts[i];
    const expectedTool = cat.expectedTools[i];
    const expectedAction = cat.expectedActions[i];

    // Run through discover_tools
    const result = discoverTools(prompt, 5);
    const topLegacy = result.recommendedTools[0]?.name || '(none)';
    const topScore = result.recommendedTools[0]?.relevanceScore || 0;

    // Map legacy recommendation → consolidated tool
    const mapped = reverseMap.get(topLegacy);
    const actualTool = mapped?.tool || '???';
    const actualAction = mapped?.action || '???';

    // Check if discovery found a relevant result
    const hasDiscovery = result.recommendedTools.length > 0 && topScore >= 1;

    // Check if routing is correct (matches expected)
    const toolMatch = actualTool === expectedTool;
    // Action match is looser — some questions could reasonably go to different actions
    const actionMatch = actualAction === expectedAction;
    const isCorrect = toolMatch;

    if (hasDiscovery) discoveryHits++;
    else discoveryMisses++;
    if (isCorrect) routingCorrect++;
    else routingWrong++;

    const status = isCorrect ? '✓' : '✗';
    const actionStatus = actionMatch ? '' : ` (expected action: ${expectedAction})`;
    console.log(`  ${status} "${prompt}"`);
    console.log(`    → discover: ${topLegacy} (score: ${topScore})`);
    console.log(`    → maps to: ${actualTool}.${actualAction}${actionStatus}`);
    if (!toolMatch) {
      console.log(`    ⚠ EXPECTED: ${expectedTool}.${expectedAction}`);
      issues.push({ prompt, expected: `${expectedTool}.${expectedAction}`, got: `${actualTool}.${actualAction}`, category: cat.category });
    }
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Total questions:     ${totalQuestions}`);
console.log(`  Discovery hit rate:  ${discoveryHits}/${totalQuestions} (${Math.round(discoveryHits/totalQuestions*100)}%)`);
console.log(`  Correct tool:        ${routingCorrect}/${totalQuestions} (${Math.round(routingCorrect/totalQuestions*100)}%)`);
console.log(`  Wrong tool:          ${routingWrong}/${totalQuestions}`);

if (issues.length > 0) {
  console.log(`\n  ⚠ ISSUES (${issues.length}):`);
  for (const iss of issues) {
    console.log(`    [${iss.category}] "${iss.prompt}"`);
    console.log(`      Expected: ${iss.expected}, Got: ${iss.got}`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CONSOLIDATED TOOL COVERAGE');
console.log('═══════════════════════════════════════════════════════════════');

// Check which consolidated tools are exercised by the prompts
const usedTools = new Set();
for (const cat of PROMPT_CATEGORIES) {
  for (const t of cat.expectedTools) usedTools.add(t);
}
for (const ctool of consolidatedTools) {
  const used = usedTools.has(ctool.name);
  console.log(`  ${used ? '✓' : '○'} ${ctool.name} (${Object.keys(ctool._actionMap).length} actions)`);
}

console.log('\n  Tools NOT exercised by any developer page question:');
for (const ctool of consolidatedTools) {
  if (!usedTools.has(ctool.name)) {
    console.log(`    - ${ctool.name}`);
  }
}
console.log();
