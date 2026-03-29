# GeoTap MCP Server

[![npm version](https://img.shields.io/npm/v/geotap-mcp-server.svg)](https://www.npmjs.com/package/geotap-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Connect Claude, Cursor, Windsurf, and other AI tools to 80+ US federal environmental and infrastructure data sources.**

GeoTap aggregates data from FEMA, USGS, EPA, NOAA, USDA, USFWS, DOT, Census, and more — accessible through the MCP (Model Context Protocol).

> **Web App**: [geotapdata.com](https://geotapdata.com) — no code required, draw on a map and explore data visually.

---

## Getting Started

### 1. Register for a Free API Key

```bash
curl -X POST https://geotapdata.com/api/keys/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com"}'
```

You'll receive your API key by email. An API key is **required** to use the MCP server.

### 2. Install the MCP Server

#### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "geotap": {
      "command": "npx",
      "args": ["-y", "geotap-mcp-server"],
      "env": {
        "GEOTAP_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Claude Code

Add to your MCP settings:

```json
{
  "mcpServers": {
    "geotap": {
      "command": "npx",
      "args": ["-y", "geotap-mcp-server"],
      "env": {
        "GEOTAP_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Cursor

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "geotap": {
      "command": "npx",
      "args": ["-y", "geotap-mcp-server"],
      "env": {
        "GEOTAP_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Windsurf / Other MCP Clients

```bash
npm install -g geotap-mcp-server
GEOTAP_API_KEY=your-api-key-here geotap-mcp
```

### 3. Start Asking Questions

- *"What are the flood zones at 123 Main St, Austin TX?"*
- *"Is this property in a wetland?"*
- *"What soil types are on this site?"*
- *"What's the 100-year rainfall for Dallas?"*
- *"Delineate the watershed at this point"*
- *"Are there any EPA Superfund sites near here?"*
- *"What's the curve number for this drainage area?"*
- *"Run a full environmental site analysis for this parcel"*
- *"What permits do I need to build near this stream?"*
- *"Generate a design storm hyetograph for a 25-year, 24-hour event"*

---

## Data Sources

| Agency | Data Available |
|--------|---------------|
| **FEMA** | Flood zones, FIRM panels, flood insurance rate maps, floodway boundaries |
| **USGS** | Elevation (3DEP at 1m/10m/30m), geology, streamgages, groundwater, land use (NLCD), StreamStats, National Streamflow Statistics (NSS) |
| **EPA** | Water quality (ATTAINS), Superfund sites, brownfields, TRI toxic releases, USTs, NPDES outfalls |
| **NOAA** | Rainfall (Atlas 14), IDF curves, tide stations, climate projections (CMIP6), weather stations, radar |
| **USDA/NRCS** | Soils (SSURGO), curve numbers, hydrologic soil groups, TR-55 parameters |
| **USFWS** | Wetlands (NWI), endangered species, critical habitat |
| **DOT** | Bridges, tunnels, National Bridge Inventory |
| **Census** | Demographics, boundaries, TIGER geographic data |
| **USACE** | Dams, levees, navigation channels |
| **NHD** | Stream flowlines, hydrography, watershed boundaries (HUC-8/10/12) |
| **Other** | Power plants, mines, tribal lands, building footprints, and more |

Every response includes **source attribution** — the federal agency, dataset name, and reference URL.

---

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `GEOTAP_API_KEY` | Your API key from registration | **Yes** |
| `GEOTAP_API_URL` | Custom API endpoint (advanced) | No |

### Rate Limits

| Tier | Monthly Requests | Burst (per min) | Cost |
|------|-----------------|------------------|------|
| **Free** | 50 | 5/min | Free |
| **Starter** | 1,000 | 20/min | Coming soon |
| **Pro** | 10,000 | 60/min | Coming soon |
| **Enterprise** | 100,000 | 200/min | Coming soon |

---

## Use Cases

### Civil & Environmental Engineering
- Stormwater design: rainfall (Atlas 14, IDF curves, hyetographs), curve numbers, time of concentration, peak discharge
- Flood analysis: Bulletin 17C flood frequency, flow duration curves, regional regression estimates
- Watershed delineation and hydrologic modeling inputs (HEC-HMS, SWMM)
- Low-flow analysis for NPDES permits (7Q10, 7Q2, harmonic mean flow)
- Climate-adjusted design storms for infrastructure resilience

### Real Estate & Development
- Environmental due diligence for property transactions
- Site feasibility and developability scoring (0-100 scale)
- Flood zone, wetland, and contamination screening
- Permit pathway analysis (Section 404, NPDES, floodplain development)

### Environmental Consulting
- Phase I ESA desktop data gathering (EPA sites, water quality)
- Wetland delineation support (NWI + soils + hydrology)
- Endangered species habitat screening (USFWS critical habitat)
- Water quality impairment assessment (EPA ATTAINS 303(d) list)

---

## Contributing

Contributions welcome! Please open an issue or pull request.

## License

MIT

## Links

- **Web App**: [geotapdata.com](https://geotapdata.com)
- **Issues**: [GitHub Issues](https://github.com/jcholly/geotap-developer/issues)
- **npm**: [geotap-mcp-server](https://www.npmjs.com/package/geotap-mcp-server)
