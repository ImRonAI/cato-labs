import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const frontendDesign = readFileSync(
  join(process.cwd(), '.agents/skills/frontend-design/SKILL.md'),
  'utf8'
).replace(/^---[\s\S]*?---\s*/, '');

const DISCOVERABILITY_SKILL = `Optimize the website for search engine SEO and AI discoverability:
- Craft a clear <title>, <meta name="description">, Open Graph tags, and semantic heading hierarchy (<h1>, <h2>, <h3>) aligned with the researched keywords and search intent.
- Embed valid <script type="application/ld+json"> Schema.org structured data matching the business entity.
- Position copy and calls-to-action to stand out against the researched competitors.`;

export const REASONING_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const BUILD_CONFIG = {
  model: 'anthropic/claude-opus-5-5',
  max_output_tokens: 128_000,
  max_steps: 100,
  background: true,
  stream: true,
  store: true,
  reasoning: { effort: 'high' as ReasoningEffort },
  tools: [
    { type: 'web_search' },
    { type: 'people_search' },
    { type: 'finance_search' },
    { type: 'image_search' },
    { type: 'fetch_url' },
    { type: 'sandbox' },
  ],
  skills: [
    { type: 'builtin', name: 'office' },
    {
      type: 'inline',
      name: 'frontend-design',
      description:
        "Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that don't read as templated defaults.",
      instructions: frontendDesign,
    },
    {
      type: 'inline',
      name: 'discoverability',
      description: 'SEO, structured data, and search discoverability guidance for modern websites.',
      instructions: DISCOVERABILITY_SKILL,
    },
  ],
};

export const CHAT_WIDGET_REQUIREMENTS = `MANDATORY CATO LABS HAIKU CHATBOT WIDGET:
Embed a complete, accessible, responsive Cato Labs chat widget in the generated website's HTML/CSS/JavaScript. It represents Cato Labs (powered by anthropic/claude-haiku-5-5 on POST /api/vibe-chat with Telnyx voice call capability) to help the visitor turn this sample website into a full production build and capture their lead information (name, business, project needs, and phone number with explicit consent before any AI voice call).
- Transport contract inside the preview canvas: send parent.postMessage({ type: 'cato:chat', requestId, input }, '*') where requestId is unique and input is the user message (1-4000 chars). Listen for window message events where data.type === 'cato:chat:event' and data.requestId === requestId.
- Handle data.event: append event.delta on 'response.output_text.delta', finish on 'response.completed', and surface errors on 'response.failed', 'response.incomplete', 'response.cancelled', or 'error'.
- After the page finishes rendering, trigger one real proactive introduction request with input: 'A visitor has opened the generated website. Introduce Cato Labs and offer help with their website and AI implementation project.'`;

export const BUILD_INSTRUCTIONS = `You are Cato Studio's website design and development agent. Turn the user's brief into a complete, distinctive Three.js multipage sample website.

1. Research the industry, SEO, competitors, leadership, financials, and design direction using your native tools:
   - Use web_search and the discoverability skill to research search intent, SEO keywords, and direct competitors.
   - Use fetch_url to inspect authoritative competitor or reference websites.
   - Use finance_search to check relevant public company or market benchmark financials.
   - Use people_search to identify key founders, owners, or executives in the competitive landscape.
   - Use image_search to gather visual references, photography, and design inspiration matching the requested or most fitting aesthetic direction.
2. Build the complete standalone HTML5 document from <!doctype html> through </html> (including interactive Three.js visuals, working multipage/section navigation, SEO and Schema.org metadata from the discoverability skill, and the embedded Cato Labs Haiku chatbot widget), save it as /home/user/workspace/index.html in the sandbox in a single write, and call share_file on /home/user/workspace/index.html. Do not install or run headless browsers/Playwright or take screenshots in the sandbox; the live preview renders directly in Cato Studio's browser canvas.
3. Output a concise Markdown summary of your research findings, competitive and financial benchmarks, and design architecture in your response text (do not re-paste the full HTML document in the message text once /home/user/workspace/index.html is shared via share_file).

${CHAT_WIDGET_REQUIREMENTS}`;
