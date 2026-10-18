import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GENUI_GUIDE } from '@/lib/genui';

/**
 * The `cato-concierge` inline Agent Skill — coaching for the builder. It
 * teaches the exact pattern every site's concierge runs on, quoting
 * lib/pplx.ts verbatim (read from disk, so the coaching can never drift
 * from the code), and the AI Elements contract the conversation renders with.
 */

const core = readFileSync(join(process.cwd(), 'lib/pplx.ts'), 'utf8');

export const CONCIERGE_SKILL = {
  type: 'inline' as const,
  name: 'cato-concierge',
  description:
    'Load before calling set_site_config, and whenever you write the concierge launcher or persona. ' +
    'It is the exact runtime every Cato-built site\'s chatbot runs on: model, tools, skills, files, MCP and the UI it renders with.',
  instructions: `# The Cato concierge — how every site's chatbot works

Every site you build gets a chatbot agent: anthropic/claude-haiku-5-5 on the Perplexity Agent API, with the SAME tools and components you have. You don't write its code — our platform runs it — but you design its persona and launcher for it, so know exactly what it can do.

## The whole runtime is one small file (lib/pplx.ts)
It follows the perplexity_agent_api skill: the official TypeScript SDK, \`background: true\` + \`stream: true\`, every built-in tool except connectors, the Telnyx Remote MCP, the Office skills, and sandbox file download. Any call can spread extra params (model, max_steps, response_format, more skills…) for whatever a customer asks for.

\`\`\`ts
${core}
\`\`\`

The concierge route calls it like this, once per visitor message:

\`\`\`ts
for await (const ev of run({ model: 'anthropic/claude-haiku-5-5', instructions, input: messages, max_steps: 16 })) {
  const ui = toUi(ev);           // Agent API event → one shared UI event
  if (ui) send(ui);              // streamed to the browser as SSE
}
\`\`\`

## What each tool is for
- web_search — facts, hours, seasonality, local events. fetch_url — read one specific page.
- image_search — when a visitor wants to see something. finance_search — market or public-company figures. people_search — named people.
- sandbox — ONLY real data analysis or code execution. With the office skill it also produces documents (PDF/DOCX/PPTX/XLSX) delivered by share_file → the visitor gets a download chip. Visitors can't upload files; "editing" a document means regenerating it with their changes.
- mcp "telnyx" (https://api.telnyx.com/v2/mcp, Streamable HTTP, key server-side) — the lead engine: after a visitor shares name + phone/email AND consents, send ONE SMS with the lead to the team.

## How the conversation renders (AI Elements, in the host app)
- Task → wraps each reply's work; inside it ChainOfThought steps.
- Web / finance / people search → ChainOfThoughtSearchResults with favicon chips.
- fetch_url → Tool (input: urls, output: pages read). Sandbox code → Sandbox (code / output tabs).
- Shared files → TaskItemFile download chips. Generative UI → JSXPreview.

${GENUI_GUIDE}

## What you supply in set_site_config
personaName, personaRole, personaVoice, greeting and suggestedQuestions — written so these moments happen ("Want a quote as a PDF?", "Compare the two suites side by side?", "Shall I have the team text you?"). The page itself carries only the launcher: \`<div data-vibe-chat><button data-vibe-chat-toggle aria-label="Chat with {persona}">…</button></div>\`, styled with an \`.is-open\` state.`,
};
