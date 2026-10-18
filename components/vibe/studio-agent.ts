/**
 * Client-safe description of the studio's real Agent API configuration.
 * app/api/vibe-build/config.ts sends exactly these tools and this model, so the
 * Agent component in the studio always shows what the provider actually runs.
 */
export const STUDIO_MODEL = 'anthropic/claude-opus-5-5';

export const STUDIO_TOOLS = [
  { type: 'web_search', name: 'Web search', description: 'Search the web for current facts and sources.' },
  { type: 'people_search', name: 'People search', description: 'Find public professional profiles relevant to the brief.' },
  { type: 'finance_search', name: 'Finance search', description: 'Retrieve quotes and company data for a public benchmark.' },
  { type: 'image_search', name: 'Image search', description: 'Find visual references with their source pages.' },
  { type: 'fetch_url', name: 'Fetch URL', description: 'Read the full content of an authoritative page.' },
  { type: 'sandbox', name: 'Sandbox', description: 'Write, run and verify the website code, then share its files.' },
] as const;

export type StudioToolType = (typeof STUDIO_TOOLS)[number]['type'];

export const STUDIO_AGENT_SUMMARY = "You are Cato Studio's website design and development agent. Turn the client's brief into a complete, useful website, with verified content, intentional visual design, accessible interactions, and downloadable source.";
