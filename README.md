# AssetHub MCP

AssetHub MCP is the public MCP client for [Asset Hub MCP](https://assethubmcp.com). It lets Codex, Claude Code, Cursor, and other MCP clients search a hosted catalog of game assets, install exact files into a project, and write attribution metadata.

This repository intentionally contains only the installable MCP client. The hosted API, billing, account system, and paid catalog infrastructure are private service code.

## Tools

- `search_assets` - Search by type, query, tags, license, format, and source.
- `search_asset_files` - Search inside archives for exact files such as `click_001.ogg`.
- `download_asset` - Download and extract an authorized asset pack into a target directory.
- `install_asset_files` - Install exact files returned by file search.
- `install_best_asset` - Search and install the best matching files in one call.
- `get_attribution` - Generate attribution text and JSON metadata for selected assets.
- `list_licenses` - Show supported license policies and safe defaults.

## Install

```bash
npx @tcamp404/assethub-mcp ASSET_HUB_API_KEY=ah_your_customer_key
```

`ASSET_HUB_API_BASE_URL` defaults to `https://assethubmcp.com`.

## MCP Client Config

```json
{
  "mcpServers": {
    "asset-hub": {
      "command": "npx",
      "args": ["@tcamp404/assethub-mcp"],
      "env": {
        "ASSET_HUB_API_KEY": "ah_your_customer_key",
        "ASSET_HUB_API_BASE_URL": "https://assethubmcp.com"
      }
    }
  }
}
```

## Example Agent Flow

```json
{
  "tool": "install_best_asset",
  "arguments": {
    "type": "sound",
    "query": "short menu click UI blip",
    "targetDir": "public/audio/ui",
    "projectRoot": "/path/to/game",
    "includeExtensions": [".wav", ".ogg"],
    "maxFiles": 3
  }
}
```

For exact file installs:

```json
{
  "tool": "search_asset_files",
  "arguments": {
    "type": "sound",
    "query": "short menu click",
    "formats": [".ogg"],
    "limit": 3
  }
}
```

Then pass the returned `asset.id` and `file.entryPath` values to `install_asset_files`.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT. Installed third-party assets keep their original licenses and source metadata.
