/**
 * Industry pages — copy deck.
 * Index + twelve industry child routes under /industries.
 * IndustryCopy extends the shared ChildCopy contract with a market
 * truth and three plays mapped to Cato practices.
 */

import type { ChildCopy } from './capabilities';

export interface IndustryPlay {
  title: string;
  body: string;
}

export interface IndustryCopy extends ChildCopy {
  marketTruth: string;
  plays: IndustryPlay[];
}

export const industriesIndex = {
  eyebrow: 'Industries',
  titleLines: ['The method,', 'in your market.'],
  lede:
    'The approach is constant; the terrain is not. Twelve markets where Cato’s six practices interlock against dynamics we have mapped — each with its own truth, its own plays and its own trade-offs.',
} as const;

export const industries: IndustryCopy[] = [
  {
    slug: 'ecommerce-retail',
    crumbLabel: 'E-commerce & Retail',
    eyebrow: 'Industries — E-commerce & Retail',
    titleLines: ['Own the shelf,', 'own the margin.'],
    lede:
      'Category strategy, flagship commerce and AI-assisted service for brands that refuse to rent their customers from marketplaces.',
    marketTruth:
      'Marketplaces own the default click and tax every sale they touch. The brands that keep their margin are the ones customers seek out by name — which means brand, experience and retention are the economics, not the marketing.',
    features: [
      {
        index: '01',
        title: 'Category strategy',
        body:
          'The category is mapped — competitors, price architecture, search demand — and the position chosen deliberately. Assortment and pricing follow the strategy, not the feed.',
      },
      {
        index: '02',
        title: 'Flagship commerce',
        body:
          'The store is built as the flagship: editorial-grade design, fast on every device, conversion-architected from the first scroll.',
      },
      {
        index: '03',
        title: 'AI concierge & retention',
        body:
          'An on-brand concierge guides, recommends and resolves; lifecycle automation brings customers back. Repeat rate becomes the growth engine.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'From concept to category: the Resting Art model.',
      body:
        'Cato’s own luxury furniture concept, Resting Art, runs the full arc — category strategy, brand, flagship e-commerce, AI concierge and local capture — as one integrated build. It is the working proof of what this playbook does for a retail brand.',
      bullets: [
        'Category & assortment strategy',
        'Flagship e-commerce builds',
        'Marketplace & channel trade-offs',
        'AI concierge & guided selling',
        'Retention & lifecycle automation',
        'Local & search capture',
      ],
    },
    faq: [
      {
        q: 'We sell mostly through marketplaces. Where do we start?',
        a:
          'With the margin map: which products earn the right to go direct, and what experience justifies it. The flagship and the marketplace strategy are designed together.',
      },
      {
        q: 'Can you work with our existing platform?',
        a:
          'Yes — Shopify, headless commerce or custom. The experience layer is rebuilt around what already works; replatforming only when the evidence demands it.',
      },
      {
        q: 'What does the AI concierge actually sell?',
        a:
          'It guides: fit, style, comparison, availability, order status. In luxury and considered purchases, guidance is what converts — discounting is the tax on its absence.',
      },
    ],
    plays: [
      {
        title: 'Strategy & Transformation',
        body:
          'Category design, price architecture and channel trade-offs — the position decided before a dollar is spent on traffic.',
      },
      {
        title: 'Digital Products & Experiences',
        body:
          'The flagship store: editorial-grade, fast, conversion-architected — the place the brand is actually experienced.',
      },
      {
        title: 'Growth & Distribution',
        body:
          'Search, content and local capture engineered as one acquisition system that compounds instead of renting.',
      },
    ],
    cta: {
      title: 'Stop renting your customers.',
      body:
        'Show us your channel mix and margin map. We will show you what owned demand is worth.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'professional-services',
    crumbLabel: 'Professional Services',
    eyebrow: 'Industries — Professional Services',
    titleLines: ['Expertise is bought', 'on evidence.'],
    lede:
      'Positioning, authority content and intelligent intake for firms whose product is judgment — and whose clients decide before the first call.',
    marketTruth:
      'Clients choose expertise on trust, and trust is built before contact: the shortlist is formed from the firm’s position, its published thinking and how it handles the first inquiry. The firm that demonstrates its thinking wins the right to price it.',
    features: [
      {
        index: '01',
        title: 'Positioning & narrative',
        body:
          'The firm’s actual expertise is isolated and stated sharply — who it serves, what it refuses, why it wins — so the right clients self-select.',
      },
      {
        index: '02',
        title: 'Authority engine',
        body:
          'Published thinking, case evidence and search architecture that put the firm on the shortlist before the RFP exists.',
      },
      {
        index: '03',
        title: 'Intelligent intake',
        body:
          'Inquiry qualification, scheduling and follow-up run as a system — every prospect answered in minutes, every engagement started with context.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'The website is the first partner meeting.',
      body:
        'For a professional-services firm, the site is not marketing; it is the demonstration. Cato builds the position, the evidence and the intake as one system — so the prospect arrives already persuaded, and the first conversation starts at the work, not the credentials.',
      bullets: [
        'Positioning & messaging',
        'Thought-leadership systems',
        'Case & credential architecture',
        'Search & intent capture',
        'Inquiry qualification',
        'Scheduling & follow-up automation',
      ],
    },
    faq: [
      {
        q: 'Our work comes from referrals. Why invest here?',
        a:
          'Referrals check the website before they call. The system does not replace the referral — it makes sure the referral converts instead of stalling.',
      },
      {
        q: 'Can you work within our compliance constraints?',
        a:
          'Yes. Claims, disclaimers and review workflows are designed in from the start. Sharp positioning does not require sharp elbows.',
      },
      {
        q: 'What about proposals and pitching?',
        a:
          'Narrative systems carry into decks and proposals — same thesis, same evidence, assembled faster. The pitch stops being a rewrite.',
      },
    ],
    plays: [
      {
        title: 'Strategy & Transformation',
        body:
          'Positioning, packaging and pricing of expertise — the firm decided on, then stated plainly.',
      },
      {
        title: 'Growth & Distribution',
        body:
          'An authority engine: intent architecture and published thinking that build the shortlist position.',
      },
      {
        title: 'AI & Agent Systems',
        body:
          'Intake that qualifies, schedules and briefs — so partners spend hours on judgment, not logistics.',
      },
    ],
    cta: {
      title: 'Make the shortlist by default.',
      body:
        'Tell us the work you want more of. We will build the system that brings it.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'hospitality',
    crumbLabel: 'Hospitality',
    eyebrow: 'Industries — Hospitality',
    titleLines: ['The direct booking', 'is the profit.'],
    lede:
      'Brand, booking experience and guest-lifecycle systems for hotels, resorts and restaurants that want to own their guests instead of renting them.',
    marketTruth:
      'The OTA owns the relationship and takes a fifth of the room rate for the privilege. Direct booking is not a channel; it is the difference between a hospitality brand and a commodity listing — and it is won on brand, experience and memory.',
    features: [
      {
        index: '01',
        title: 'Brand & experience system',
        body:
          'The property’s character is made explicit — story, imagery, tone — and carried consistently from the website to the welcome note.',
      },
      {
        index: '02',
        title: 'Booking-first flagship',
        body:
          'A fast, beautiful site with the booking flow at its center — fewer steps, clearer value, no commission attached.',
      },
      {
        index: '03',
        title: 'Guest concierge & lifecycle',
        body:
          'Pre-arrival questions answered instantly, on-property requests routed automatically, and post-stay follow-up that brings the guest back direct.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'Built for seasonal and festival economies.',
      body:
        'Hospitality demand arrives in waves — seasons, festivals, events. Cato builds the systems that capture the peak: local and event-intent search, packaging that justifies the rate, and a guest relationship that outlasts the weekend. The direct channel compounds; the commission does not.',
      bullets: [
        'Direct-booking architecture',
        'Brand & art direction',
        'Local & event-intent capture',
        'AI guest concierge',
        'Reputation & review operations',
        'Lifecycle & return-stay automation',
      ],
    },
    faq: [
      {
        q: 'Can we really reduce OTA dependence?',
        a:
          'Gradually, yes. The direct experience must be visibly better — rate, packaging, ease — and the brand worth searching for. Both are buildable.',
      },
      {
        q: 'We already have a booking engine. What changes?',
        a:
          'The engine stays; the experience around it is rebuilt. Guests abandon booking flows, not booking engines — the flagship is what carries them through.',
      },
      {
        q: 'What does the concierge handle?',
        a:
          'Pre-arrival questions, reservations, on-property requests, local recommendations — resolved instantly in the brand’s voice, escalated to staff when it matters.',
      },
    ],
    plays: [
      {
        title: 'Brand & Creative Systems',
        body:
          'The property’s story and identity, systemized — the thing guests search for by name.',
      },
      {
        title: 'Digital Products & Experiences',
        body:
          'A booking-first flagship that makes direct the obvious choice.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Guest messaging, reviews and return-stay lifecycle running as one automated system.',
      },
    ],
    cta: {
      title: 'Own the guest relationship.',
      body:
        'Pull last quarter’s commission line. That is the budget for building direct.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'real-estate',
    crumbLabel: 'Real Estate',
    eyebrow: 'Industries — Real Estate',
    titleLines: ['Listings are commodities.', 'Authority is not.'],
    lede:
      'Local search capture, agent branding and inquiry automation for brokerages, teams and developers competing above the listing feed.',
    marketTruth:
      'The portals commoditize the listing; the agent who wins is the one the seller already trusts. Local authority — neighborhood knowledge, published proof, instant response — is the moat the portals cannot replicate.',
    features: [
      {
        index: '01',
        title: 'Local authority capture',
        body:
          'Neighborhood-by-neighborhood search architecture — guides, market data, proof — so the queries that signal intent land on you, not the portal.',
      },
      {
        index: '02',
        title: 'Brand for agents & teams',
        body:
          'A personal or team brand that reads as expertise: positioning, identity and a content system built around the markets you actually know.',
      },
      {
        index: '03',
        title: 'Instant inquiry response',
        body:
          'Every inquiry answered in minutes — qualified, scheduled and logged — because the first agent to respond usually gets the client.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'Own the neighborhood before the listing.',
      body:
        'Real-estate marketing chases listings; authority compounds. Cato builds the neighborhood-intent layer, the brand that makes it credible and the response system that converts it — so when the seller is ready, the choice is already made.',
      bullets: [
        'Neighborhood & intent architecture',
        'Agent & team brand systems',
        'Listing & development showcases',
        'Inquiry triage & scheduling',
        'Market-report automation',
        'Review & referral operations',
      ],
    },
    faq: [
      {
        q: 'Can you compete with the portals on search?',
        a:
          'Not head-on — and you should not try. The win is the long tail: neighborhood, school-district and lifestyle intent the portals serve badly.',
      },
      {
        q: 'We are a small team. Is this overkill?',
        a:
          'No — small teams benefit most. One defensible neighborhood beachhead outperforms a generic city-wide presence at a fraction of the cost.',
      },
      {
        q: 'Does this work for developers and new projects?',
        a:
          'Yes — project showcases, lead capture and nurture sequences designed for long consideration cycles and high price points.',
      },
    ],
    plays: [
      {
        title: 'Growth & Distribution',
        body:
          'Neighborhood-intent architecture and local capture — the beachhead strategy, block by block.',
      },
      {
        title: 'Brand & Creative Systems',
        body:
          'The agent, team or project brand — positioning and identity that read as authority.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Inquiry response, nurture and market-report automation — speed to lead without the headcount.',
      },
    ],
    cta: {
      title: 'Own your neighborhood.',
      body:
        'Name the three neighborhoods you want to be known for. That is where the architecture starts.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'health-wellness',
    crumbLabel: 'Health & Wellness',
    eyebrow: 'Industries — Health & Wellness',
    titleLines: ['Wellness is a', 'membership business.'],
    lede:
      'Brand, booking experience and retention systems for wellness and practice-growth brands — built on trust, measured on return visits.',
    marketTruth:
      'Nobody commits to wellness once. The economics live in the second visit, the membership and the plan — which means acquisition without a retention system is a leaky bucket, and trust is the only channel that compounds.',
    features: [
      {
        index: '01',
        title: 'Trust-first brand',
        body:
          'Positioning, identity and language that make the practice feel considered before the first visit — calm, credible, never clinical-cold.',
      },
      {
        index: '02',
        title: 'Booking-first experience',
        body:
          'The site removes every excuse: clear services, transparent pricing, instant booking, reminders that actually reduce no-shows.',
      },
      {
        index: '03',
        title: 'Retention engine',
        body:
          'Recall, reactivation and membership lifecycle automated — because the second visit is where the business model lives.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'Growth marketing for practices and wellness brands.',
      body:
        'Cato works on the growth side: brand, search, booking and retention. Clinical claims are your regulators’ territory, not ours — the work here is making a practice findable, bookable and worth returning to, with marketing that respects the trust the industry runs on.',
      bullets: [
        'Practice & brand positioning',
        'Local & treatment-intent search',
        'Booking & scheduling flows',
        'Recall & reactivation automation',
        'Membership & package architecture',
        'Reputation & review systems',
      ],
    },
    faq: [
      {
        q: 'Do you handle medical or clinical marketing claims?',
        a:
          'No. We build growth systems — brand, booking, retention — and keep claims conservative and reviewable. Your compliance counsel keeps the pen on clinical language.',
      },
      {
        q: 'Can the booking flow work with our practice software?',
        a:
          'In most cases, yes. The experience layer integrates with existing scheduling and patient-management systems rather than replacing them.',
      },
      {
        q: 'How do you reduce no-shows?',
        a:
          'Confirmation and reminder sequences timed to how people actually behave — plus frictionless rescheduling, which recovers more appointments than guilt does.',
      },
    ],
    plays: [
      {
        title: 'Brand & Creative Systems',
        body:
          'A trust-first identity — considered, credible and consistent from search result to front desk.',
      },
      {
        title: 'Growth & Distribution',
        body:
          'Local and treatment-intent capture that makes the practice the obvious nearby choice.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Reminders, recall and membership lifecycle — the retention engine behind the second visit.',
      },
    ],
    cta: {
      title: 'Fill the calendar, keep the client.',
      body:
        'Show us your booking flow and your return rate. The gap between them is the opportunity.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'home-services',
    crumbLabel: 'Home Services',
    eyebrow: 'Industries — Home Services',
    titleLines: ['The job goes to', 'whoever answers.'],
    lede:
      'Local capture, instant response and reputation systems for the trades — plumbing to pest control — where speed-to-lead decides the work.',
    marketTruth:
      'When a pipe bursts or the AC dies, the customer calls down the map pack until somebody competent answers. Rankings get you on the list; response speed and review proof get you the job. Everything else is decoration.',
    features: [
      {
        index: '01',
        title: 'Map-pack & local capture',
        body:
          'Service-area and job-type search architecture — built to put you in the three results that matter, for the jobs you actually want.',
      },
      {
        index: '02',
        title: 'Voice AI answering',
        body:
          'Every call answered, day or night: scoped, quoted, booked. Missed calls stop being lost jobs.',
      },
      {
        index: '03',
        title: 'Reputation operations',
        body:
          'Review requests timed to the satisfied moment, responses handled, ratings monitored — proof that compounds with every job.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'Speed to lead, systemized.',
      body:
        'Home-services marketing is won in minutes: the ranking, the answer, the quote. Cato builds the three as one system — local capture that rings the phone, a voice agent that answers it, and follow-up automation that turns one job into a review, a referral and a maintenance plan.',
      bullets: [
        'Local & service-area SEO',
        'Voice AI call answering',
        'Quote & booking automation',
        'Review generation & response',
        'Seasonal campaign systems',
        'Maintenance-plan lifecycle',
      ],
    },
    faq: [
      {
        q: 'We already pay for leads. Why build this?',
        a:
          'Bought leads are shared, price-shopped and stop when you stop paying. Owned capture compounds — the ranking, the reviews and the brand stay yours.',
      },
      {
        q: 'Does the voice agent really book jobs?',
        a:
          'Yes — scoped against your services, pricing rules and calendar, with a human handoff for anything unusual. It books the job or books the callback.',
      },
      {
        q: 'What about seasonality?',
        a:
          'The system leans into it: pre-season campaigns, maintenance-plan reminders and off-peak offers timed to keep crews scheduled year-round.',
      },
    ],
    plays: [
      {
        title: 'Growth & Distribution',
        body:
          'Map-pack and service-area capture for the jobs you actually want, in the zones you actually serve.',
      },
      {
        title: 'AI & Agent Systems',
        body:
          'Voice AI that answers every call, quotes the standard work and books the calendar.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Reviews, follow-ups and maintenance plans — every job compounding into the next.',
      },
    ],
    cta: {
      title: 'Answer every call.',
      body:
        'Count last month’s missed calls. Multiply by your average job value. That is the business case.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'legal',
    crumbLabel: 'Legal',
    eyebrow: 'Industries — Legal',
    titleLines: ['Clients choose counsel', 'under stress.'],
    lede:
      'Positioning, authority content and careful intake automation for firms whose clients arrive urgently, anxiously and ready to decide.',
    marketTruth:
      'Legal clients decide fast, under pressure, on evidence of competence — the clarity of the practice area, the credibility of the content, the speed of the response. The firm that is findable, legible and first to answer takes the matter.',
    features: [
      {
        index: '01',
        title: 'Practice-area positioning',
        body:
          'Each practice area is positioned sharply — who it serves, what it handles, what it costs to wait — so the right client recognizes their situation instantly.',
      },
      {
        index: '02',
        title: 'Authority & intent architecture',
        body:
          'Content built around real client questions, structured for search and answer engines — the firm’s expertise, legible before the consultation.',
      },
      {
        index: '03',
        title: 'Careful intake automation',
        body:
          'Inquiry response in minutes, conflict-aware qualification, consultation scheduling — with a human handoff wherever judgment is required.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'Legible, credible, first to answer.',
      body:
        'Legal marketing fails in two directions: louder than the bar allows, or quieter than the client needs. Cato builds the middle path — sharp positioning, conservative claims, and an intake system that treats an anxious inquiry like the moment it is.',
      bullets: [
        'Practice-area positioning',
        'Client-question content systems',
        'Search & answer-engine architecture',
        'Intake & qualification flows',
        'Consultation scheduling',
        'Ethics-aware claim review',
      ],
    },
    faq: [
      {
        q: 'Can marketing stay within bar rules?',
        a:
          'Yes — the system is designed around them. Claims stay conservative, disclaimers are structural, and nothing ships without your review.',
      },
      {
        q: 'Does intake automation feel cold to anxious clients?',
        a:
          'Designed properly, it feels like competence: an immediate, clear response and a booked consultation. Silence is what feels cold.',
      },
      {
        q: 'What about confidentiality in the intake flow?',
        a:
          'Intake collects only what qualification requires, and sensitive detail is routed to secure channels. Automation handles logistics, not privileged facts.',
      },
    ],
    plays: [
      {
        title: 'Strategy & Transformation',
        body:
          'Practice-area positioning and pricing clarity — the firm stated so the right client self-identifies.',
      },
      {
        title: 'Growth & Distribution',
        body:
          'Intent architecture around real client questions — authority that compounds across search and answer engines.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Intake, qualification and scheduling that respond in minutes and hand off with judgment.',
      },
    ],
    cta: {
      title: 'Be findable when it matters.',
      body:
        'Tell us the practice areas you want to grow. We will build the system that brings the right matters.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'financial-services',
    crumbLabel: 'Financial Services',
    eyebrow: 'Industries — Financial Services',
    titleLines: ['Trust is the product.', 'Clarity sells it.'],
    lede:
      'Positioning, compliance-conscious content and client-onboarding systems for advisors, lenders and fintechs competing on trust.',
    marketTruth:
      'Financial products are bought on trust, and trust is built out of clarity: who this is for, what it costs, what happens next. The firm that explains itself plainly — and responds like it means it — earns the right to manage the money.',
    features: [
      {
        index: '01',
        title: 'Positioning & narrative',
        body:
          'The offer stated in plain language — audience, promise, proof — so the right client understands the fit before the first meeting.',
      },
      {
        index: '02',
        title: 'Compliance-conscious content',
        body:
          'Education and insight published on a reviewable workflow — sharp enough to build authority, conservative enough to pass compliance.',
      },
      {
        index: '03',
        title: 'Onboarding & lifecycle automation',
        body:
          'Qualification, document chase, scheduling and follow-up run as a system — the client’s first ninety days, choreographed.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'Authority without the asterisk farm.',
      body:
        'Financial marketing tends to fail on trust: overpromised, underexplained. Cato builds the opposite — a position stated plainly, content that teaches instead of teases, and onboarding that proves the firm has its act together before a dollar moves.',
      bullets: [
        'Offer & audience positioning',
        'Educational content systems',
        'Search & answer-engine capture',
        'Lead qualification & routing',
        'Onboarding workflow automation',
        'Review-integrated publishing',
      ],
    },
    faq: [
      {
        q: 'How do you handle compliance review?',
        a:
          'As a workflow, not an obstacle. Content is drafted inside approved claims frameworks and routed through your reviewers before anything publishes.',
      },
      {
        q: 'Does this work for regulated products?',
        a:
          'Yes, with the right constraints. We do not write suitability or performance claims — we build the clarity and trust systems around them.',
      },
      {
        q: 'Where does automation actually pay off?',
        a:
          'Onboarding. The document chase, the scheduling, the follow-up — automating the logistics is what makes a small team feel institutional.',
      },
    ],
    plays: [
      {
        title: 'Strategy & Transformation',
        body:
          'Offer and audience positioning — the promise stated plainly enough to be trusted.',
      },
      {
        title: 'Growth & Distribution',
        body:
          'Educational authority that captures intent across search and answer engines — on a compliance-safe cadence.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Onboarding and lifecycle automation that makes the first ninety days feel choreographed.',
      },
    ],
    cta: {
      title: 'Earn trust at scale.',
      body:
        'Show us how a client finds and onboards with you today. We will find the trust leaks.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'dental-med-spa',
    crumbLabel: 'Dental & Med Spa',
    eyebrow: 'Industries — Dental & Med Spa',
    titleLines: ['The chair is filled', 'by local intent.'],
    lede:
      'Local search, booking experience and recall automation for dental practices and med spas — growth systems for appointment-driven businesses.',
    marketTruth:
      'Patients choose nearby, book fast and judge on presentation. The practice that owns local intent, makes booking effortless and runs its recall properly fills chairs; the one that relies on reminders taped to the fridge does not.',
    features: [
      {
        index: '01',
        title: 'Local & treatment-intent capture',
        body:
          'Search architecture for the treatments and neighborhoods that matter — so “near me” lands on your practice, presented the way you would present it.',
      },
      {
        index: '02',
        title: 'Booking-first experience',
        body:
          'Services explained plainly, pricing handled honestly, booking in two taps — the site behaves like your best front desk on its best day.',
      },
      {
        index: '03',
        title: 'Recall & reactivation',
        body:
          'Hygiene recalls, treatment follow-ups, lapsed-patient reactivation — automated, timed and measured. The calendar fills from the base you already have.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'Growth systems for appointment-driven practices.',
      body:
        'Cato works the growth side of the practice: how patients find you, book you and come back. Clinical claims stay with your clinicians and your counsel — our job is the brand, the booking flow and the recall engine, built to respect the trust a practice runs on.',
      bullets: [
        'Local & map-pack capture',
        'Treatment-intent content',
        'Booking & scheduling flows',
        'Recall & reactivation automation',
        'Membership & package systems',
        'Review & reputation operations',
      ],
    },
    faq: [
      {
        q: 'Do you write treatment or outcome claims?',
        a:
          'No. Marketing stays conservative and reviewable — your clinicians and counsel approve anything clinical. We build the growth system around it.',
      },
      {
        q: 'Can it integrate with our practice-management software?',
        a:
          'Usually, yes. Booking and recall are layered onto your existing systems rather than ripped out.',
      },
      {
        q: 'What fills chairs fastest?',
        a:
          'Reactivation. The cheapest appointment is the patient who already trusts you — recall automation usually outperforms new-patient acquisition in the first quarter.',
      },
    ],
    plays: [
      {
        title: 'Growth & Distribution',
        body:
          'Local and treatment-intent capture that makes the practice the obvious nearby choice.',
      },
      {
        title: 'Digital Products & Experiences',
        body:
          'A booking-first site that behaves like the best front desk you ever hired.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Recall, reactivation and review systems — the calendar filled from the base you already have.',
      },
    ],
    cta: {
      title: 'Fill the calendar from your base.',
      body:
        'Pull your lapsed-patient list. Its length is the opportunity — and the first automation.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'fitness-studios',
    crumbLabel: 'Fitness Studios',
    eyebrow: 'Industries — Fitness Studios',
    titleLines: ['Churn is the real', 'competitor.'],
    lede:
      'Brand, trial conversion and retention systems for studios and gyms — built for belonging, measured on the members who stay.',
    marketTruth:
      'Studios do not sell workouts; they sell belonging. Acquisition gets the trial, but the business is won or lost in week six — which makes retention engineering, not ad spend, the growth lever that compounds.',
    features: [
      {
        index: '01',
        title: 'Brand & community system',
        body:
          'The studio’s point of view made explicit — who it is for, how it feels, why it is worth the price — carried from the site to the studio floor.',
      },
      {
        index: '02',
        title: 'Trial-to-member architecture',
        body:
          'The trial is choreographed: booking, first visit, instructor intro, the follow-up that lands at the right hour. Conversion becomes a system, not a hope.',
      },
      {
        index: '03',
        title: 'Retention & win-back',
        body:
          'Attendance signals watched, lapses caught early, win-backs timed — because a saved membership is cheaper than a sold one.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'The membership is the product.',
      body:
        'Class packs and intro offers are the front door; the membership is the business. Cato builds the systems around that truth — a brand worth joining, a trial that converts and retention automation that catches the lapse before it becomes a cancellation.',
      bullets: [
        'Studio brand & positioning',
        'Class & trial booking flows',
        'Intro-offer architecture',
        'Retention & lapse automation',
        'Win-back campaigns',
        'Community & content systems',
      ],
    },
    faq: [
      {
        q: 'We already get trials. Why are we not growing?',
        a:
          'Because trials are not the business — week six is. The gap is almost always conversion choreography and lapse response, both of which are systemizable.',
      },
      {
        q: 'Can this work with our existing studio software?',
        a:
          'Yes. Booking, attendance and lifecycle automation integrate with the studio management stack you already run.',
      },
      {
        q: 'What does retention automation actually do?',
        a:
          'Watches attendance, flags the lapse, sends the right message at the right moment — and tells the instructor when a personal nudge beats an automated one.',
      },
    ],
    plays: [
      {
        title: 'Brand & Creative Systems',
        body:
          'A point of view worth joining — identity and voice carried from the site to the studio floor.',
      },
      {
        title: 'Growth & Distribution',
        body:
          'Local capture and intro-offer architecture that keeps the trial pipeline full.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Trial choreography, lapse response and win-back — retention run as a system.',
      },
    ],
    cta: {
      title: 'Keep the members you earn.',
      body:
        'Pull your week-six retention number. Everything we build moves that figure.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'saas-startups',
    crumbLabel: 'SaaS & Startups',
    eyebrow: 'Industries — SaaS & Startups',
    titleLines: ['Distribution decides', 'more than features.'],
    lede:
      'Category narrative, product-led web experience and agent-assisted operations for software companies that have built something and need it found.',
    marketTruth:
      'The best product routinely loses to the clearest story. Buyers shortlist from the category narrative they have already absorbed — which makes positioning, the website and the first-run experience the real product surface.',
    features: [
      {
        index: '01',
        title: 'Category design & narrative',
        body:
          'The category is named, the enemy identified, the position stated — so the market has a box to put you in, and it is one you chose.',
      },
      {
        index: '02',
        title: 'Product-led web experience',
        body:
          'The site demonstrates rather than describes: interactive proof, honest pricing, docs-grade clarity — the product’s quality, legible in the marketing.',
      },
      {
        index: '03',
        title: 'Agent-assisted operations',
        body:
          'Support, onboarding and qualification run agent-first with human judgment on top — leverage for a team that refuses to scale headcount linearly.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'Built by people who ship product.',
      body:
        'Cato builds its own software, agents and AI-native sites — the same systems it sells. For a SaaS team, that means the advice comes from operators: what to say, what to build, what to automate, and — just as important — what to skip this quarter.',
      bullets: [
        'Category design & positioning',
        'Narrative & messaging systems',
        'Product-led site & docs experience',
        'Launch & announcement systems',
        'Agent-assisted support & onboarding',
        'Founder-brand & content engines',
      ],
    },
    faq: [
      {
        q: 'We are pre-product-market-fit. Too early?',
        a:
          'For a full build, maybe. For positioning and narrative, no — clarity is how you find PMF faster. We scope to the stage, not the retainer.',
      },
      {
        q: 'Can you match our pace?',
        a:
          'Yes. The model is built for product velocity — short cycles, shipped increments, decisions made on evidence instead of committee.',
      },
      {
        q: 'What about developer-facing products?',
        a:
          'Docs-grade clarity is a specialty: information architecture, interactive examples and a site that respects an engineer’s skepticism.',
      },
    ],
    plays: [
      {
        title: 'Strategy & Transformation',
        body:
          'Category design and narrative — the position chosen before the market chooses one for you.',
      },
      {
        title: 'Digital Products & Experiences',
        body:
          'A product-led site and docs experience that demonstrates instead of describes.',
      },
      {
        title: 'AI & Agent Systems',
        body:
          'Agent-assisted support and onboarding — leverage that lets a small team feel much larger.',
      },
    ],
    cta: {
      title: 'Get the story as good as the product.',
      body:
        'Show us the homepage and the demo. The distance between them is where we work.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'architecture-interior-design',
    crumbLabel: 'Architecture & Interior Design',
    eyebrow: 'Industries — Architecture & Interior Design',
    titleLines: ['Clients buy', 'a point of view.'],
    lede:
      'Positioning, portfolio experience and inquiry systems for architecture and design practices whose work deserves a better frame.',
    marketTruth:
      'A design client buys judgment they cannot evaluate directly — so they buy the point of view, the portfolio and the confidence of the process. The practice that presents its thinking, not just its photographs, wins the considered projects.',
    features: [
      {
        index: '01',
        title: 'Positioning & editorial brand',
        body:
          'The practice’s sensibility stated as a position — the work it takes, the work it refuses — with identity and language to match.',
      },
      {
        index: '02',
        title: 'Portfolio as flagship',
        body:
          'The portfolio rebuilt as an editorial experience — process, drawings, photography, narrative — that sells the thinking behind the images.',
      },
      {
        index: '03',
        title: 'Inquiry qualification',
        body:
          'Project inquiries scoped, budget-qualified and scheduled with care — so the studio’s hours go to the projects that fit.',
      },
    ],
    detail: {
      eyebrow: 'In practice',
      title: 'The portfolio is the salesperson.',
      body:
        'Design practices undersell themselves with galleries. A considered client wants the reasoning: the constraints, the moves, the outcome. Cato builds the portfolio as an argument — and wraps it in an inquiry system that respects both the client’s ambition and the studio’s time.',
      bullets: [
        'Practice positioning',
        'Identity & art direction',
        'Editorial portfolio builds',
        'Process & narrative presentation',
        'Inquiry scoping & qualification',
        'Publication & awards systems',
      ],
    },
    faq: [
      {
        q: 'Our work speaks for itself. Why reposition?',
        a:
          'It speaks to people who already understand design. Positioning translates the work into a point of view clients can buy before they can evaluate it.',
      },
      {
        q: 'Can a website really win considered projects?',
        a:
          'It wins the first meeting — which is where considered projects are decided. The portfolio that shows thinking outperforms the one that shows rooms.',
      },
      {
        q: 'How do you handle project confidentiality?',
        a:
          'Carefully. Publication strategy is part of the work — what is shown, what is teased, what stays private — agreed per client and per project.',
      },
    ],
    plays: [
      {
        title: 'Brand & Creative Systems',
        body:
          'The practice positioned as a point of view — identity and language equal to the work.',
      },
      {
        title: 'Digital Products & Experiences',
        body:
          'An editorial portfolio experience that presents the thinking, not just the photography.',
      },
      {
        title: 'Operations & Automation',
        body:
          'Inquiry scoping and scheduling that protects studio hours for the projects that fit.',
      },
    ],
    cta: {
      title: 'Frame the work properly.',
      body:
        'Show us the portfolio and the projects you want more of. We will close the distance.',
      label: 'Start a build',
      href: '/contact',
    },
  },
];
