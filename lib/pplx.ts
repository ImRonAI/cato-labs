import fs from 'node:fs';
import path from 'node:path';
import Perplexity from '@perplexity-ai/perplexity_ai';

/**
 * The whole Agent API harness. POST /v1/agent runs the loop server-side —
 * reasoning, tool calls, sandbox, skills, files — so this is one
 * `responses.create` with `background: true` + `stream: true`, nothing else.
 */

export const MODEL = 'anthropic/claude-opus-5-5';
/** direct-model default is 1; the API caps at 500 */
export const MAX_STEPS = 100;
/** required for anthropic/* models */
export const MAX_OUTPUT_TOKENS = 128_000;

export const pplx = new Perplexity({
  apiKey: process.env.VIBE_PPLX_KEY || process.env.PERPLEXITY_API_KEY,
});

export type SdkParams = Parameters<typeof pplx.responses.create>[0];
export type Tool = NonNullable<SdkParams['tools']>[number];
export type Skill = NonNullable<SdkParams['skills']>[number];

export type AgentEvent = {
  type: string;
  sequence_number?: number;
  delta?: string;
  text?: string;
  error?: { message?: string; code?: string };
  response?: { id: string; status: string; output?: unknown[]; error?: { message?: string } };
} & Record<string, unknown>;

/** every built-in tool, plus the Telnyx Remote MCP when a key is configured */
export const TOOLS: Tool[] = [
  { type: 'web_search' },
  { type: 'fetch_url' },
  { type: 'image_search' },
  { type: 'finance_search' },
  { type: 'people_search' },
  { type: 'sandbox' },
  ...(process.env.TELNYX_API_KEY
    ? [
        {
          type: 'mcp' as const,
          server_url: process.env.TELNYX_MCP_URL || 'https://api.telnyx.com/v2/mcp',
          server_label: 'telnyx',
          authorization: process.env.TELNYX_API_KEY,
          defer_loading: true,
          require_approval: 'never' as const,
        },
      ]
    : []),
];

const SKILL_DIRS = [
  'frontend-design',
  'high-end-visual-design',
  'design-taste-frontend',
  'build-awwwards-quality-sites',
];

function inlineSkill(dir: string): Skill | null {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(process.cwd(), '.agents', 'skills', dir, 'SKILL.md'), 'utf8');
  } catch {
    return null;
  }
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  const fm = m ? m[1] : '';
  const body = (m ? m[2] : raw).trim();
  if (!body) return null;
  const name = (/^name:\s*(.+)$/m.exec(fm)?.[1] ?? dir).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 64);
  const description = (/^description:\s*(.+)$/m.exec(fm)?.[1] ?? `Design skill: ${name}`).trim().slice(0, 1024);
  return { type: 'inline', name, description, instructions: body.slice(0, 65_000) };
}

/** the Office skills plus the four design skills from .agents/skills */
export const SKILLS: Skill[] = [
  { type: 'builtin', name: 'office' },
  ...SKILL_DIRS.map(inlineSkill).filter((s): s is Skill => s !== null),
];

export async function* run(params: SdkParams): AsyncGenerator<AgentEvent> {
  const stream = await pplx.responses.create({
    model: MODEL,
    max_steps: MAX_STEPS,
    max_output_tokens: MAX_OUTPUT_TOKENS,
    tools: TOOLS,
    skills: SKILLS,
    ...params,
    background: true,
    stream: true,
  });
  for await (const ev of stream) yield ev as unknown as AgentEvent;
}

export const listFiles = (responseId: string) => pplx.responses.files.list(responseId);
export const fileContent = (responseId: string, fileId: string) =>
  pplx.responses.files.content(fileId, { response_id: responseId });
