export type ResearchSearchProvider = "tavily" | "brave" | "serpapi" | "none" | "";

export interface ResearchSearchConfig {
  enabled: boolean;
  provider: ResearchSearchProvider;
  apiKeyPresent: boolean;
  ready: boolean;
  userNote: string;
  developerStatus: "disabled" | "missing_provider" | "missing_api_key" | "configured";
}

export function getResearchSearchConfig(): ResearchSearchConfig {
  const enabled = process.env.RESEARCH_SEARCH_ENABLED === "true";
  const provider = (process.env.RESEARCH_SEARCH_PROVIDER?.trim().toLowerCase() || "none") as ResearchSearchProvider;
  const apiKeyPresent = Boolean(process.env.RESEARCH_SEARCH_API_KEY?.trim());

  if (!enabled) {
    return {
      enabled: false,
      provider: "none",
      apiKeyPresent,
      ready: false,
      userNote: "External web search was not enabled for this run.",
      developerStatus: "disabled",
    };
  }

  if (!provider || provider === "none") {
    return {
      enabled: true,
      provider,
      apiKeyPresent,
      ready: false,
      userNote: "External web search was requested but no search provider is configured.",
      developerStatus: "missing_provider",
    };
  }

  if (!apiKeyPresent) {
    return {
      enabled: true,
      provider,
      apiKeyPresent,
      ready: false,
      userNote: "External web search was requested but the search provider key is missing.",
      developerStatus: "missing_api_key",
    };
  }

  return {
    enabled: true,
    provider,
    apiKeyPresent,
    ready: true,
    userNote: `External web search provider is configured: ${provider}.`,
    developerStatus: "configured",
  };
}
