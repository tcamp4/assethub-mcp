# AssetHub MCP

AssetHub MCP is the public MCP client for [Asset Hub MCP](https://assethubmcp.com). It lets Codex, Claude Code, Cursor, and other MCP clients search a hosted catalog of game assets, install exact files into a project, and write attribution metadata.

This repository intentionally contains only the installable MCP client. The hosted API, billing, account system, and paid catalog infrastructure are private service code.

## Tools

- `search_assets` - Search by type, query, tags, license, format, source, and game-fit hints.
- `search_asset_files` - Search inside archives for exact files such as `click_001.ogg`, with ranking hints for game genre, mood, style, use case, and avoided concepts.
- `recommend_assets_for_game` - Turn a game idea into a curated starter kit with categories, fit reasons, exact file suggestions, target directories, and install calls.
- `download_asset` - Download and extract an authorized asset pack into a target directory.
- `install_asset_files` - Install exact files returned by file search.
- `install_best_asset` - Search and install the best matching files in one call.
- `get_attribution` - Generate attribution text and JSON metadata for selected assets.
- `browse_catalog_options` - Show categories, sources, use cases, and example queries available to the current plan.
- `list_licenses` - Show supported license policies and safe defaults.

## Install

```bash
npx -y @tcamp404/assethub-mcp@latest ASSET_HUB_API_KEY=ah_your_customer_key
```

`ASSET_HUB_API_BASE_URL` defaults to `https://assethubmcp.com`.

## MCP Client Config

```json
{
  "mcpServers": {
    "asset-hub": {
      "command": "npx",
      "args": ["-y", "@tcamp404/assethub-mcp@latest"],
      "env": {
        "ASSET_HUB_API_KEY": "ah_your_customer_key",
        "ASSET_HUB_API_BASE_URL": "https://assethubmcp.com"
      }
    }
  }
}
```

## Example Agent Flow

Start with a recommendation when the game concept is broader than one exact asset:

```json
{
  "tool": "recommend_assets_for_game",
  "arguments": {
    "gameDescription": "A cozy farming game with crops, animals, shop menus, and gentle reward sounds.",
    "gameGenre": "cozy farming",
    "mood": "soft friendly",
    "visualStyle": "pixel 2d",
    "avoid": ["horror", "weapon", "sci-fi"],
    "maxCategories": 5
  }
}
```

The response includes a selected kit, recommended categories, best matching packs/files, target directories, and ready-to-run `install_best_asset` arguments.

```json
{
  "tool": "install_best_asset",
  "arguments": {
    "type": "sound",
    "query": "short menu click UI blip",
    "gameGenre": "cozy farming",
    "mood": "soft friendly",
    "intendedUse": "menu confirm",
    "avoid": ["horror", "weapon", "loud"],
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
    "gameContext": "cozy farming game main menu",
    "intendedUse": "short menu confirm",
    "formats": [".ogg"],
    "limit": 3
  }
}
```

Then pass the returned `asset.id` and `file.entryPath` values to `install_asset_files`.

For better matches, agents should pass fit hints whenever the game context matters:

- `gameContext`: short description of the game, level, scene, or mechanic.
- `gameGenre`: examples include `cozy farming`, `fantasy RPG`, `sci-fi shooter`, `puzzle`, or `racing`.
- `mood`: examples include `cute`, `tense`, `dark`, `friendly`, `retro`, or `futuristic`.
- `visualStyle`: examples include `pixel`, `low-poly`, `cartoon`, `monochrome`, or `hand-drawn`.
- `intendedUse`: examples include `background loop`, `menu confirm`, `NPC`, `enemy`, `inventory icon`, or `terrain tile`.
- `prefer` and `avoid`: extra concepts to reward or penalize.

## Hosted API Contract

The hosted API stays private, but the client talks to a small documented JSON contract:

- `POST /v1/search`
- `POST /v1/files/search`
- `GET /v1/assets/:assetId`
- `GET /v1/catalog/options`
- `GET /v1/catalog/kits`
- `POST /v1/recommendations/game`
- `GET /v1/licenses`

All hosted requests use:

```http
Authorization: Bearer ah_your_customer_key
```

`search_assets` may return locked upgrade matches when the current plan is too small:

```json
{
  "results": [],
  "lockedResults": [
    {
      "id": "kenney-music-jingles",
      "title": "Kenney Music Jingles",
      "accessible": false,
      "upgradeRequired": "indie",
      "minimumPlan": "indie"
    }
  ],
  "plan": "free"
}
```

`search_asset_files` may return `lockedAssetResults` for above-plan packs when no accessible file results are found.

Use `browse_catalog_options` when an agent needs to discover what the catalog can answer before searching. It returns plan-specific categories, source names, curated use cases, and example queries such as `short menu click`, `cozy farming sprites`, `hex strategy tiles`, and `low poly furniture props`.

Use `recommend_assets_for_game` when the prompt is a whole game or prototype. Current curated kits include cozy farming, fantasy RPG, platformer, space shooter, puzzle/casual, and a general prototype fallback.

## Claude Code

```bash
claude mcp add --transport stdio asset-hub --scope user \
  --env ASSET_HUB_API_KEY=ah_your_customer_key \
  --env ASSET_HUB_API_BASE_URL=https://assethubmcp.com \
  -- npx -y @tcamp404/assethub-mcp@latest
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT. Installed third-party assets keep their original licenses and source metadata.
