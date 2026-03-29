# GeoTap MCP Server

[![npm version](https://img.shields.io/npm/v/geotap-mcp-server.svg)](https://www.npmjs.com/package/geotap-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Connect Claude, Cursor, Windsurf, and other AI tools to 80+ US federal environmental and infrastructure data sources.**

GeoTap aggregates data from FEMA, USGS, EPA, NOAA, USDA, USFWS, DOT, Census, and more — accessible through the MCP (Model Context Protocol).

> **Web App**: [geotapdata.com](https://geotapdata.com) — no code required, draw on a map and explore data visually.

---

## Getting Started

### Prerequisites

- **Node.js** (v18 or later) — [download here](https://nodejs.org/)
- An email address to register for your API key

### Step 1: Get Your API Key

Go to **[geotapdata.com/developers](https://geotapdata.com/developers)** and register with your email to get a free API key.

Your API key will be sent to your email. **Save it** — you'll need it in the next step.

### Step 2: Set Up the MCP Server

Choose your AI tool below and follow the instructions. The MCP server is installed automatically via `npx` — no manual download needed.

---

<details open>
<summary><strong>Claude Desktop</strong></summary>

1. Open Claude Desktop
2. Go to **Settings** (gear icon) → **Developer** → **Edit Config**
3. This opens your `claude_desktop_config.json` file. Add the following (replace `your-api-key-here` with your actual key):

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

> **Config file location:**
> - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
> - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

4. **Restart Claude Desktop** completely (quit and reopen)
5. You should see a hammer icon (🔨) in the chat input — that means GeoTap is connected

</details>

---

<details>
<summary><strong>Claude Code (CLI)</strong></summary>

Run this command to add GeoTap to your Claude Code MCP servers:

```bash
claude mcp add geotap -- npx -y geotap-mcp-server
```

Then set your API key as an environment variable. Add this to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):

```bash
export GEOTAP_API_KEY="your-api-key-here"
```

Restart your terminal, then start Claude Code. GeoTap tools will be available automatically.

</details>

---

<details>
<summary><strong>Cursor</strong></summary>

1. Open Cursor
2. Go to **Settings** (⌘ + , on Mac, Ctrl + , on Windows) → search for **"MCP"**
3. Click **"Edit in settings.json"** or add to your `.cursor/mcp.json` file:

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

4. Restart Cursor
5. Open the AI chat panel — GeoTap tools will appear in the available tools list

</details>

---

<details>
<summary><strong>Windsurf</strong></summary>

1. Open Windsurf
2. Go to **Settings** → **MCP Servers** (or edit `~/.codeium/windsurf/mcp_config.json` directly)
3. Add:

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

4. Restart Windsurf

</details>

---

<details>
<summary><strong>Other MCP-Compatible Clients</strong></summary>

For any MCP client, the server can be run directly:

```bash
# Install globally
npm install -g geotap-mcp-server

# Run with your API key
GEOTAP_API_KEY=your-api-key-here geotap-mcp
```

The server communicates over **stdio** — point your MCP client to the `geotap-mcp` command with the `GEOTAP_API_KEY` environment variable set.

</details>

---

### Step 3: Start Asking Questions

Once connected, ask your AI assistant to pull data for any US site. GeoTap collects from all 80+ federal sources at once — just give it a location and then ask whatever you want:

```
"Collect site data for 123 Main St, Austin TX"
```

Once the data comes back (~60-120 seconds), you can ask follow-up questions like:

- *"Is this site in a flood zone?"*
- *"What soil types are here and what's the curve number?"*
- *"Are there any contamination concerns nearby?"*
- *"What's the 100-year rainfall?"*
- *"What permits would I need to develop this site?"*
- *"Summarize the key environmental risks"*

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Server won't start / "GEOTAP_API_KEY is required" | Make sure your API key is set in the `env` block of your MCP config |
| "npx: command not found" | Install [Node.js](https://nodejs.org/) (v18+), which includes npx |
| Tools don't appear in Claude Desktop | Restart Claude Desktop completely (quit + reopen, not just close the window) |
| Rate limit errors | Wait a moment and retry — burst limits are per-minute |

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
