/**
 * The nine stops of Cato's journey on /capabilities/ai-agent-systems.
 * Copy: research/palm-springs-seo-brief.md §8 (draft, owner review pending).
 * `id` doubles as the data-scene-section id.
 */

export interface JourneyStop {
  id: string;
  eyebrow: string;
  titleLines: [string, string];
  body: string;
  tags: string[];
}

export const journeyStops: JourneyStop[] = [
  {
    id: 'omnichannel',
    eyebrow: 'AI receptionist & SMS',
    titleLines: ['One agent.', 'Every channel.'],
    body: 'Cato answers voice calls, replies to texts, sorts email, reads inbound fax and joins video calls with one persona and one memory across every line. It runs on Telnyx communications infrastructure, so numbers, call routing and SMS registration are set up properly, not improvised. The 10pm reservation call in Palm Springs gets the same care as the 10am email.',
    tags: ['AI voice receptionist', 'Registered business SMS', 'Email & fax intake', 'Video presence', 'Shared memory across channels'],
  },
  {
    id: 'entertainment',
    eyebrow: 'Guest experience',
    titleLines: ['Work done.', 'Music on.'],
    body: "Agents are not only for the back office. Ask Cato for a lobby loop, a pool-deck set or a jingle for the weekend special, and it composes and plays an original track. For hotels, rentals and venues in a valley that runs on festival weekends, that means guest-facing moments in your brand's voice.",
    tags: ['Generated music & audio', 'Guest-facing entertainment', 'Brand-voice soundtracks', 'Concierge moments'],
  },
  {
    id: 'tooling',
    eyebrow: 'Live tool building',
    titleLines: ['It builds the tool.', 'You use it.'],
    body: 'When a task needs a tool that does not exist, Cato builds one while you talk: a working interface, assembled from components and rendered right here in a sandbox. Anything that touches the real world, a call, a text, an email, waits for your approval first. Capability grows without loosening control.',
    tags: ['Tools built on demand', 'Sandboxed rendering', 'Approval before action', 'Full audit log'],
  },
  {
    id: 'automation',
    eyebrow: 'Workflow automation',
    titleLines: ['The busywork,', 'handled.'],
    body: 'Intake, scheduling, invoicing, follow-ups, the spreadsheet everyone updates by hand. Cato runs the repeatable workflow end to end across your CRM, calendar, booking system and inbox, and stops for a person wherever judgment is required. For a lean Coachella Valley team, that means high-season coverage without high-season hiring.',
    tags: ['End-to-end workflows', 'CRM, PMS & calendar integration', 'Human approval steps', 'Exception handling'],
  },
  {
    id: 'frameworks',
    eyebrow: 'Frameworks & deployment',
    titleLines: ['The right framework.', 'The right home.'],
    body: "Cato is built on the frameworks that hold up in production, chosen per task: Strands, Vercel's Eve, LangChain, CrewAI, the OpenAI Agents SDK, the Claude Agent SDK, the Perplexity Agent API, Temporal, Gemini Live, ElevenLabs, Vapi and Telnyx. Then we put agents to work inside the tools your engineers already use: Claude Code, Codex, OpenCode, Cursor, Devin and more.",
    tags: [
      'Strands', 'Vercel Eve', 'LangChain', 'CrewAI', 'Antigravity SDK agents', 'OpenCode SDK agents', 'OpenAI Agents SDK',
      'Claude Agent SDK', 'Perplexity Agent API', 'Temporal', 'Zapier', 'Mistral', 'ElevenLabs', 'Gemini Live', 'Vapi', 'Telnyx', 'MCP',
      'Claude Code', 'Codex', 'OpenCode', 'Cursor', 'Devin', 'Trae AI', 'Kimi Code', 'Mistral Vibe', 'Grok Build', 'Qwen Code', 'and more',
    ],
  },
  {
    id: 'seo-marketing',
    eyebrow: 'AI search & marketing',
    titleLines: ['Found in search.', 'Cited in answers.'],
    body: 'Cato researches the query, drafts the page, structures the data and tracks what ranks, in Google results and in AI answers from Google AI Overviews, ChatGPT and Perplexity. Every page is written for people first and reviewed by a person before it ships. For Palm Springs, that means content timed to the season, not the annual average.',
    tags: ['Local & technical SEO', 'Answer engine optimization', 'Structured data', 'Seasonal content calendars', 'Human editorial review'],
  },
  {
    id: 'lead-gen',
    eyebrow: 'AI lead generation',
    titleLines: ['More of the right', 'conversations.'],
    body: 'Cato finds prospects that match your ideal customer, researches each one and drafts outreach worth answering: personal, consent-aware and paced to the rules of each channel. Inbound gets the same care. Every form, call and chat becomes a logged lead within moments, with the source and the context attached.',
    tags: ['Prospect research', 'Personalized outreach', 'Consent-aware sequences', 'Instant inbound capture'],
  },
  {
    id: 'lead-qualify',
    eyebrow: 'Lead qualification',
    titleLines: ['Every lead,', 'properly asked.'],
    body: 'Cato replies to new inquiries quickly, asks the questions your best salesperson would, scores the answers against your criteria and books the ready ones straight onto the calendar. The rest are nurtured, not dropped. Your team spends its hours with real buyers, and the full conversation is already in the CRM.',
    tags: ['Fast first response', 'Your scoring criteria', 'Calendar booking', 'CRM handoff with transcript'],
  },
  {
    id: 'support-compliance',
    eyebrow: 'Support & compliance',
    titleLines: ['Support that', 'follows the rules.'],
    body: "Cato resolves the routine case, escalates the sensitive one and documents both. For legal, financial and other regulated teams, deployments are designed around your obligations: TCPA consent for calls, 10DLC registration for texts, CCPA/CPRA privacy rights and California's bot-disclosure rule. Your counsel sets the policy. Cato follows it, every time.",
    tags: ['TCPA consent & opt-out', '10DLC-registered messaging', 'CCPA/CPRA data rights', 'Bot disclosure & audit trails'],
  },
];
