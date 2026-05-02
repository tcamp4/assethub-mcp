import type { AssetRecord, FileSearchFilters, GameRecommendationInput, SearchFilters } from "./types.js";

export interface HostedConfig {
  apiKey?: string;
  baseUrl: string;
}

export function applyArgEnv(argv = process.argv.slice(2)): void {
  for (const arg of argv) {
    const match = /^([A-Z][A-Z0-9_]+)=(.*)$/.exec(arg);
    if (match && match[1].startsWith("ASSET_HUB_")) {
      process.env[match[1]] = match[2];
    }
  }
}

export function getHostedConfig(env = process.env): HostedConfig {
  return {
    apiKey: env.ASSET_HUB_API_KEY || env.API_KEY,
    baseUrl: env.ASSET_HUB_API_BASE_URL || "https://assethubmcp.com",
  };
}

export function assertHostedConfigured(config = getHostedConfig()): void {
  if (!config.apiKey) {
    throw new Error(
      "ASSET_HUB_API_KEY is required. Create an account at https://assethubmcp.com, then pass ASSET_HUB_API_KEY=ah_... to this MCP server.",
    );
  }
}

export async function hostedSearchAssets(filters: SearchFilters, config = getHostedConfig()): Promise<Record<string, unknown>> {
  return hostedPost("/v1/search", filters, config);
}

export async function hostedSearchAssetFiles(filters: FileSearchFilters, config = getHostedConfig()): Promise<Record<string, unknown>> {
  return hostedPost("/v1/files/search", filters, config);
}

export async function hostedRecommendAssetsForGame(input: GameRecommendationInput, config = getHostedConfig()): Promise<Record<string, unknown>> {
  return hostedPost("/v1/recommendations/game", input, config);
}

export async function hostedGetAsset(assetId: string, config = getHostedConfig()): Promise<AssetRecord> {
  assertHostedConfigured(config);
  const response = await fetch(new URL(`/v1/assets/${encodeURIComponent(assetId)}`, config.baseUrl), {
    headers: {
      authorization: `Bearer ${config.apiKey}`,
    },
  });
  const payload = (await response.json()) as AssetRecord & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Asset Hub request failed with ${response.status}`);
  }
  return payload;
}

export async function hostedListLicenses(config = getHostedConfig()): Promise<unknown> {
  assertHostedConfigured(config);
  const response = await fetch(new URL("/v1/licenses", config.baseUrl), {
    headers: {
      authorization: `Bearer ${config.apiKey}`,
    },
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Asset Hub request failed with ${response.status}`);
  }
  return payload;
}

export async function hostedGetCatalogOptions(config = getHostedConfig()): Promise<unknown> {
  assertHostedConfigured(config);
  const response = await fetch(new URL("/v1/catalog/options", config.baseUrl), {
    headers: {
      authorization: `Bearer ${config.apiKey}`,
    },
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Asset Hub request failed with ${response.status}`);
  }
  return payload;
}

async function hostedPost(path: string, body: object, config: HostedConfig): Promise<Record<string, unknown>> {
  assertHostedConfigured(config);
  const response = await fetch(new URL(path, config.baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(sanitizeBody(body as Record<string, unknown>)),
  });
  const payload = (await response.json()) as Record<string, unknown> & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Asset Hub request failed with ${response.status}`);
  }
  return payload;
}

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));
}
