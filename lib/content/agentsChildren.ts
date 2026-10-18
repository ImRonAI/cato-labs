/**
 * AI & Agent Systems — grandchild pages.
 * The four specialisms under /capabilities/ai-agent-systems.
 * Rendered from the shared ChildCopy contract.
 */

import type { ChildCopy } from './capabilities';

export type AgentChildSlug =
  | 'voice-ai'
  | 'generative-ui'
  | 'customer-experience'
  | 'knowledge-architecture';

export const agentChildren: Record<AgentChildSlug, ChildCopy> = {
  'voice-ai': {
    slug: 'voice-ai',
    crumbLabel: 'Voice AI',
    eyebrow: 'AI & Agent Systems — Voice AI',
    titleLines: ['Agents that answer', 'the phone.'],
    lede:
      'Voice agents that call, listen and resolve — answering every inbound call, making the outbound ones your team never gets to, and handing to humans with the transcript attached.',
    features: [
      {
        index: '01',
        title: 'Inbound call answering',
        body:
          'Every call answered on the first ring, at 2 p.m. or 2 a.m. — hours, pricing, booking, rescheduling — in the brand’s voice, not a phone tree.',
      },
      {
        index: '02',
        title: 'Outbound calling',
        body:
          'Recall reminders, refill confirmations, quote follow-ups: the calls your team means to make, made on schedule and logged to the system of record.',
      },
      {
        index: '03',
        title: 'Handoff with context',
        body:
          'When a call needs a human, the human gets the transcript, the intent and the next step. Nobody asks the caller to repeat themselves.',
      },
    ],
    detail: {
      eyebrow: 'Proof',
      title: 'It already works — we run it ourselves.',
      body:
        'Cato built a pharmacy-call assistant that phones patients, confirms refill details, answers the questions it is scoped for and logs every outcome — real calls, resolved end to end, with a pharmacist looped in whenever judgment is required. That is the standard every Cato voice agent is held to: not a demo, a working line of business.',
      bullets: [
        'Natural, low-latency conversation',
        'Booking & calendar integration',
        'Outbound campaign scheduling',
        'Call recording & transcripts',
        'Human escalation with full context',
        'Compliance-aware call design',
      ],
    },
    faq: [
      {
        q: 'Will callers know they are talking to an AI?',
        a:
          'Yes — the agent introduces itself honestly. What surprises callers is not that it is an AI; it is that the problem gets resolved on the first call.',
      },
      {
        q: 'What happens when the agent cannot help?',
        a:
          'It escalates — to a human line, a callback queue or a booked slot — with the transcript and intent attached. No dead ends, no repeated explanations.',
      },
      {
        q: 'Can it make outbound calls?',
        a:
          'Yes. Appointment reminders, recall campaigns, quote follow-ups — scheduled, consented and logged, at a volume no team sustains by hand.',
      },
      {
        q: 'What does it integrate with?',
        a:
          'Calendars, CRMs, booking systems and phone infrastructure — the agent reads and writes to your systems, so nothing lives in a spreadsheet.',
      },
    ],
    cta: {
      title: 'Never miss a call again.',
      body:
        'Count last month’s missed calls and voicemails. That number is the business case.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  'generative-ui': {
    slug: 'generative-ui',
    crumbLabel: 'Generative UI',
    eyebrow: 'AI & Agent Systems — Generative UI',
    titleLines: ['Interfaces that', 'assemble themselves.'],
    lede:
      'Generative UI composes the interface in real time — per user, per context, per intent — instead of forcing every visitor through the same fixed pages.',
    features: [
      {
        index: '01',
        title: 'Context-aware composition',
        body:
          'The interface reads intent — the question asked, the account state, the moment — and assembles the right components, in the right order, for that user alone.',
      },
      {
        index: '02',
        title: 'Governed component systems',
        body:
          'Generation happens inside a design system: approved components, tokens and rules. The AI composes; it does not improvise the brand.',
      },
      {
        index: '03',
        title: 'Conversation to interface',
        body:
          'Ask for the comparison, get the comparison table. Ask for availability, get the calendar. The answer is an interface, not a paragraph.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'One interface, rendered a thousand ways.',
      body:
        'A fixed page is a compromise: designed for an average visitor who does not exist. Generative UI replaces the compromise with a governed system of components the agent assembles per session — search results, product configurators, dashboards, booking flows — each rendered for the person actually there.',
      bullets: [
        'Intent detection & routing',
        'Component & token governance',
        'Real-time interface composition',
        'Conversational surfaces',
        'Privacy-respecting personalization',
        'Evaluation & guardrails',
      ],
    },
    faq: [
      {
        q: 'Is this just a chatbot with extra steps?',
        a:
          'No. A chatbot returns text; generative UI returns working interfaces — tables, configurators, calendars — composed from your design system, on the fly.',
      },
      {
        q: 'How do you stop it from breaking the design?',
        a:
          'The model can only assemble approved components under design-system rules. Generation is constrained by governance, not corrected after the fact.',
      },
      {
        q: 'Where does generative UI pay off first?',
        a:
          'Complex catalogs, configurators and dashboards — anywhere one fixed page forces every visitor through the same compromise.',
      },
    ],
    cta: {
      title: 'Let the interface adapt.',
      body:
        'Show us the page where every visitor gets the same compromise. That is where generative UI starts.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  'customer-experience': {
    slug: 'customer-experience',
    crumbLabel: 'Customer Experience',
    eyebrow: 'AI & Agent Systems — Customer Experience',
    titleLines: ['Not an FAQ bot.', 'A concierge.'],
    lede:
      'A concierge with persona, knowledge and judgment — resolving needs across the whole journey and escalating to your team at exactly the right moment.',
    features: [
      {
        index: '01',
        title: 'Persona by design',
        body:
          'Named, expert and on-brand. The concierge sounds like your best hire on their best day — consistently, at any hour.',
      },
      {
        index: '02',
        title: 'Knowledge, not scripts',
        body:
          'It works from governed knowledge — catalog, policies, availability — so it answers the question asked, not the closest canned match.',
      },
      {
        index: '03',
        title: 'Escalation with judgment',
        body:
          'The concierge knows the limit of its brief. When a moment needs a human, it hands over warmly, with the full context attached.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'The front door of the business.',
      body:
        'An FAQ bot deflects; a concierge resolves. Cato customer-experience agents carry the journey — discovery, comparison, booking, support, follow-up — as one continuous conversation across web, chat, email and voice. The customer feels considered; the team sees every thread in one place.',
      bullets: [
        'Persona & voice design',
        'Governed knowledge grounding',
        'Journey-wide resolution',
        'Human handoff & escalation',
        'Omnichannel continuity',
        'Satisfaction & resolution analytics',
      ],
    },
    faq: [
      {
        q: 'How is this different from the chatbot we have?',
        a:
          'A bot matches keywords to canned answers. A concierge holds a brief: persona, live knowledge, real skills and the judgment to escalate. Resolution, not deflection.',
      },
      {
        q: 'Can it match our brand voice?',
        a:
          'That is the first deliverable. Persona design defines how the concierge speaks, what it never says, and how it handles the moments that test a brand.',
      },
      {
        q: 'What happens when it gets something wrong?',
        a:
          'Errors are logged, reviewed and folded back into evaluation. The concierge improves on a schedule — and its scope expands only as the evidence allows.',
      },
    ],
    cta: {
      title: 'Hire the concierge.',
      body:
        'Tell us the question your team answers fifty times a day. The concierge takes it from there.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  'knowledge-architecture': {
    slug: 'knowledge-architecture',
    crumbLabel: 'Knowledge Architecture',
    eyebrow: 'AI & Agent Systems — Knowledge Architecture',
    titleLines: ['Smart agents need', 'smarter knowledge.'],
    lede:
      'Knowledge architecture is the information layer that makes enterprise agents actually smart — your catalog, policies and expertise, structured so machines can reason over them.',
    features: [
      {
        index: '01',
        title: 'Knowledge mapping',
        body:
          'Every source of truth is inventoried — docs, catalogs, policies, inboxes, tribal knowledge — and the gaps are made explicit before anything is built.',
      },
      {
        index: '02',
        title: 'Structured for retrieval',
        body:
          'Content is chunked, labeled and governed for machine use: what the agent may say, cite and act on — and what it must never touch.',
      },
      {
        index: '03',
        title: 'Governance & freshness',
        body:
          'Knowledge decays. Ownership, review cycles and update pipelines keep the architecture true, so the agent stays right as the business changes.',
      },
    ],
    detail: {
      eyebrow: 'The work',
      title: 'The difference between a demo and a deployment.',
      body:
        'Most agent failures are knowledge failures: the model is fine, the information layer is a swamp. Cato builds the architecture underneath — taxonomy, retrieval, permissions, freshness — so every agent in the business reasons over the same governed truth. This is the unglamorous work that makes the glamorous demos survive production.',
      bullets: [
        'Source-of-truth inventory',
        'Taxonomy & content modeling',
        'Retrieval architecture',
        'Permissions & compliance scoping',
        'Update pipelines & ownership',
        'Answer evaluation & audit',
      ],
    },
    faq: [
      {
        q: 'Our documentation is a mess. Is that a blocker?',
        a:
          'It is the norm. The architecture work starts from the mess — inventory, structure, governance — and usually delivers value before any agent ships.',
      },
      {
        q: 'How does this relate to search?',
        a:
          'Search finds documents for people; knowledge architecture grounds answers for agents. Same raw material, different engineering — and both benefit.',
      },
      {
        q: 'Who owns the knowledge after launch?',
        a:
          'Your team, with named owners and review cycles built in. Cato designs the governance so the architecture stays true without us.',
      },
    ],
    cta: {
      title: 'Give your agents something to know.',
      body:
        'Start with one department’s knowledge. The architecture grows from there.',
      label: 'Start a build',
      href: '/contact',
    },
  },
};
