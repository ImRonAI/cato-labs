/**
 * Client-safe description of the studio's real Agent API configuration
 * matching POST /v1/agent (create_agent_response) OpenAPI schema.
 * app/api/vibe-build/config.ts sends these exact 6 tools and model, so the
 * Agent component in the studio always shows what the provider actually runs.
 */
export const STUDIO_MODEL = 'anthropic/claude-opus-5-5';

export const STUDIO_AGENT_SUMMARY =
  'You are building a live Three.js multipage sample website for the user after researching SEO, competitors, competitor financials and owners, and design style.';

export const STUDIO_AGENT_INSTRUCTIONS_MD = `**Role:** ${STUDIO_AGENT_SUMMARY}

1. Research SEO and discoverability for the request using \`web_search\`, and use the \`discoverability\` skill.
2. Research the competition: run \`web_search\` and \`image_search\` for competitors, and pull the competition's websites using \`fetch_url\`.
3. Check the competition's financials using \`finance_search\`, find the owner of the competition, and run \`people_search\` and \`image_search\` on them.
4. Research the design style: do \`web_search\` and \`image_search\` on the style the user declares, or if they do not declare one, pick a suitable design style for the request and search that.
5. After all context is received, build a Three.js multipage website that would do well today, including the embedded Cato Labs Haiku (\`anthropic/claude-haiku-5-5\`) chatbot widget wired to \`POST /api/vibe-chat\`.`;

export const STUDIO_TOOLS = [
  {
    type: 'web_search',
    name: 'Web search',
    description: 'Web search tool configuration for the Agent API',
    jsonSchema: {
      title: 'WebSearchTool',
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['web_search'],
          description: 'Tool type identifier',
        },
        search_type: {
          type: 'string',
          enum: ['web', 'fast'],
          description:
            "Search type for this tool. `web` uses standard web search. `fast` uses the lower-latency Fast Search path, billed at $1.00 per 1,000 invocations plus model tokens. When omitted, inherits the preset's search type if configured; otherwise uses `web`.",
        },
        max_results: {
          type: 'integer',
          format: 'int32',
          minimum: 1,
          maximum: 50,
          description:
            'Upper bound on the number of search results collected per call. Must be between 1 and 50; values outside that range are rejected with a 400 error.',
        },
        max_tokens: {
          type: 'integer',
          format: 'int32',
          description: 'Maximum total tokens for search context',
        },
        max_tokens_per_page: {
          type: 'integer',
          format: 'int32',
          description: 'Maximum tokens to extract per search result page',
        },
        filters: {
          $ref: '#/components/schemas/WebSearchFilters',
          description: 'Domain and date filters for search results',
        },
        user_location: {
          $ref: '#/components/schemas/ToolUserLocation',
          description: "User's location for search personalization",
        },
      },
    },
  },
  {
    type: 'people_search',
    name: 'People search',
    description: 'People search tool configuration for the Agent API',
    jsonSchema: {
      title: 'PeopleSearchTool',
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['people_search'],
          description: 'Tool type identifier',
        },
      },
    },
  },
  {
    type: 'finance_search',
    name: 'Finance search',
    description: 'Finance search tool configuration for the Agent API',
    jsonSchema: {
      title: 'FinanceSearchTool',
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['finance_search'],
          description: 'Tool type identifier',
        },
      },
    },
  },
  {
    type: 'image_search',
    name: 'Image search',
    description: 'Image search tool configuration for the Agent API',
    jsonSchema: {
      title: 'ImageSearchTool',
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['image_search'],
        },
        max_results: {
          type: 'integer',
          format: 'int32',
          minimum: 1,
          maximum: 30,
          default: 5,
        },
        filters: {
          $ref: '#/components/schemas/ImageSearchFilters',
        },
      },
    },
  },
  {
    type: 'fetch_url',
    name: 'Fetch URL',
    description: 'Fetch URL tool configuration for the Agent API',
    jsonSchema: {
      title: 'FetchUrlTool',
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['fetch_url'],
        },
        max_urls: {
          type: 'integer',
          format: 'int32',
          minimum: 1,
          maximum: 10,
          description: 'Maximum number of URLs to fetch per tool call',
        },
      },
    },
  },
  {
    type: 'sandbox',
    name: 'Sandbox',
    description:
      'Sandbox tool configuration for the Agent API. Executes code in an isolated container during an Agent API request.',
    jsonSchema: {
      title: 'SandboxTool',
      type: 'object',
      required: ['type'],
      properties: {
        type: {
          type: 'string',
          enum: ['sandbox'],
          description: 'Tool type identifier',
        },
      },
    },
  },
] as const;

export type StudioToolType = (typeof STUDIO_TOOLS)[number]['type'];

export const STUDIO_OUTPUT_SCHEMA = `export interface AgentResponse {
  id: string;
  object: 'response';
  created_at: number;
  status: 'completed' | 'failed' | 'incomplete' | 'in_progress' | 'queued' | 'cancelled';
  model: string;
  output: (
    | MessageOutputItem
    | SearchResultsOutputItem
    | ImageSearchResultsOutputItem
    | FetchUrlResultsOutputItem
    | FinanceResultsOutputItem
    | PeopleSearchResultsOutputItem
    | FunctionCallOutputItem
    | SandboxResultsOutputItem
    | McpListToolsOutputItem
    | McpCallOutputItem
    | McpApprovalRequestOutputItem
    | ToolSearchOutputItem
  )[];
  usage?: AgentUsage;
  error?: ErrorInfo;
}`;
