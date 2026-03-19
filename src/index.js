#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { tools } from './tools.js';
import { callApi } from './api.js';

const server = new McpServer({
  name: 'geotap',
  version: '1.0.0',
  description: 'Access 28+ US federal environmental and infrastructure data sources. Query flood zones, wetlands, soils, rainfall, watersheds, water quality, endangered species, elevation, land use, and more for any location in the United States.'
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
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
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
