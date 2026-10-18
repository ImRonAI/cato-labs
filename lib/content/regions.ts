/**
 * Region pages — copy deck.
 * Index + eleven region child routes under /regions.
 * Framing: "AI-native consulting in {city}" — service-area expertise.
 * Cato is remote-first: no physical offices are claimed anywhere in
 * this deck. Local texture is referenced lightly and respectfully.
 */

import type { ChildCopy } from './capabilities';

export interface RegionAngle {
  title: string;
  body: string;
}

export interface RegionStat {
  /** The headline figure, e.g. '$16.3B' */
  value: string;
  /** What it measures + source year, e.g. 'Visitor spending, 2024 (Visit California)' */
  label: string;
}

export interface RegionPractice {
  /** The practice name, e.g. 'AI Agent Systems' */
  practice: string;
  /** What it looks like built for this specific market */
  example: string;
}

export interface RegionCopy extends ChildCopy {
  city: string;
  region: string;
  localAngles: RegionAngle[];
  /** Optional stats row — real, sourced market figures (3 per city) */
  stats?: RegionStat[];
  /** Optional "What we build here" — the six practices mapped to this market */
  practiceMap?: RegionPractice[];
}

export const regionsIndex = {
  eyebrow: 'Regions',
  titleLines: ['Where we', 'work.'],
  lede:
    'Cato is remote-first and embedded by method: each market is researched as it actually is — its search behavior, its seasons, its competitive set — before anything is built. These are the regions we know deepest.',
} as const;

export const regions: RegionCopy[] = [
  {
    slug: 'palm-springs',
    crumbLabel: 'Palm Springs',
    eyebrow: 'Regions — Palm Springs',
    city: 'Palm Springs',
    region: 'Coachella Valley, California',
    titleLines: ['AI-native consulting', 'in Palm Springs.'],
    lede:
      'Strategy, AI agents, flagship web experiences and growth systems for Palm Springs — engineered for a city where design is civic identity, hospitality is the economy, and demand arrives in festival-sized waves.',
    stats: [
      {
        value: '$1.9B',
        label:
          'Visitor spending in Palm Springs — about $5.1M a day, 2024 (Tourism Economics)',
      },
      {
        value: '3.2M',
        label:
          'Record passengers through Palm Springs International Airport, 2024 (City of Palm Springs)',
      },
      {
        value: '130K',
        label:
          'Modernism Week attendees, an estimated $68M local impact, 2024 (Modernism Week)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Brand & experience for a design town',
        body:
          'A city that fills eleven days every February with architecture tours holds its businesses to a design-literate standard. Brand and digital work here is built to meet it — not approximate it.',
      },
      {
        index: '02',
        title: 'Hospitality & seasonal capture',
        body:
          'Lodging is nearly half of what visitors spend here. Booking, pricing and guest systems are engineered around the calendar the desert actually runs on — festival spring, snowbird winter, the honest summer quiet.',
      },
      {
        index: '03',
        title: 'Agents for lean teams',
        body:
          'Voice AI, concierge and workflow automation give a small Palm Springs team the coverage of a much larger one — answering the 10pm reservation call through the season and the off-season alike.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, embedded in the market.',
      body:
        'Cato does not keep a desert office — the model is embedded research instead. A Palm Springs engagement starts with the market mapped as it is: the seasonal economy, the design culture, the competitive set from the Uptown Design District to the resort corridor and the vacation-rental blocks beyond. The build is then engineered for exactly that terrain, with on-site time scheduled whenever the work warrants it.',
      bullets: [
        'Seasonal & event-intent capture',
        'Hospitality & booking systems',
        'Brand & identity systems',
        'Voice AI & concierge agents',
        'Local search & map capture',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Digital Products',
        example:
          'Direct-booking engines for the boutique hotels and design inns the city is famous for — rate-integrity display, PMS integration, and a site that stays fast when festival-week traffic triples.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Voice AI for the 10pm reservation call after the show lets out — answered in the house voice, booked, and handed to the host stand with context by morning.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'Festival-weekend and Modernism Week surge capture — pages, campaigns and inventory staged months before the search demand multiplies overnight.',
      },
      {
        practice: 'Brand & Creative',
        example:
          'Identity systems for the town that hosts Modernism Week — built to survive the judgment of guests who know who William Krisel was.',
      },
    ],
    localAngles: [
      {
        title: 'Design-district intent',
        body:
          'Searches here carry taste: mid-century furniture, design hotels, Modernism Week tours, the Uptown Design District. The intent architecture is built around how this city is actually browsed — by people who notice kerning.',
      },
      {
        title: 'The festival calendar',
        body:
          'Demand spikes around the spring festival weekends and the winter high season, then exhales into summer. Campaigns, pricing pages and booking flows are timed to the wave — not the annual average.',
      },
      {
        title: 'The second-home economy',
        body:
          'Behind the resorts sits a year-round economy of renovation, design services, pool and landscape trades keeping seasonal homes ready. It is steady, referral-driven and searchable — if you are findable.',
      },
      {
        title: 'Alongside local partners',
        body:
          'Engagements typically plug into the existing creative scene — photographers, stylists, hospitality groups, the design-week crowd — with Cato supplying the strategy, systems and build.',
      },
    ],
    faq: [
      {
        q: 'Can you rebuild our boutique hotel’s booking flow?',
        a:
          'Yes — flagship booking experiences are core practice: direct-booking conversion, rate-integrity display, PMS integration, and the photography-led presentation a design-literate guest expects. The platform tax is usually the largest recoverable margin in Palm Springs hospitality.',
      },
      {
        q: 'How far ahead should we start for festival season?',
        a:
          'Months, not weeks. Search authority, campaign history and staged inventory take time to compound — the businesses that win April built their capture in the fall.',
      },
      {
        q: 'What should we do with the summer quiet?',
        a:
          'Use it. Shoulder season is when sites get rebuilt, brand systems get replaced and operations get automated — so the next high season runs on better machinery. The desert rewards the prepared.',
      },
      {
        q: 'Do you work with vacation rentals, or just hotels?',
        a:
          'Both — and the trades and services around them. The systems differ (permit-aware content, owner acquisition, repeat-stay automation) but the principle is the same: own the search, own the booking.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Palm Springs.',
      body:
        'Tell us what the season does to your business. We will build the system that smooths it.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'palm-desert',
    crumbLabel: 'Palm Desert',
    eyebrow: 'Regions — Palm Desert',
    city: 'Palm Desert',
    region: 'Coachella Valley, California',
    titleLines: ['AI-native consulting', 'in Palm Desert.'],
    lede:
      'AI-native strategy and implementation for Palm Desert — the mid-valley’s commercial center of gravity, from the El Paseo luxury corridor to the resorts, clubs and professional firms that anchor it.',
    stats: [
      {
        value: '$1.7B',
        label:
          'Visitor spending in Palm Desert, up year over year, 2024 (Tourism Economics)',
      },
      {
        value: '14.5M',
        label:
          'Visitors to Greater Palm Springs, spending $7.4B, 2024 (Tourism Economics)',
      },
      {
        value: '$378M',
        label:
          'College of the Desert’s annual contribution to the regional economy, FY 2021–22 (COD / CVEP)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Retail & luxury positioning',
        body:
          'The El Paseo corridor competes on presentation and relationship — RH and Arhaus did not arrive by accident. Brand, e-commerce and clienteling systems are built to match the standard the street sets.',
      },
      {
        index: '02',
        title: 'Professional-services authority',
        body:
          'Wealth management, legal, medical — Palm Desert runs on trusted expertise, much of it serving the mid-valley’s clubs and estates. Positioning, content and intake systems make that expertise findable and legible.',
      },
      {
        index: '03',
        title: 'Resort & club economics',
        body:
          'Golf, tennis and resort communities live on membership. Acquisition, onboarding and retention systems treat the member lifecycle as the asset it is.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, tuned to the mid-valley.',
      body:
        'Palm Desert is the valley’s commercial center of gravity — steadier than the resort towns, more affluent than the averages suggest, anchored by El Paseo, the Living Desert, the McCallum and College of the Desert. Cato engagements here start with that market mapped properly: the corridor, the clubs, the seasonal swing. Then the build — brand, site, agents, growth — is engineered for it. No local office; embedded research and scheduled on-sites instead.',
      bullets: [
        'Luxury retail positioning',
        'Professional-services authority',
        'Membership & club lifecycle',
        'Local & corridor capture',
        'Voice AI & concierge agents',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Brand & Creative',
        example:
          'Positioning for El Paseo retail — a brand system and digital storefront legible to the corridor’s actual customer, continuous from window to web.',
      },
      {
        practice: 'Digital Products',
        example:
          'Clienteling and appointment commerce — private appointments, trunk-show bookings, member-only drops, tee-time and spa flows engineered for relationship retail.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Concierge agents for clubs and resorts — dining reservations, court bookings and member questions answered in the club’s voice, with a graceful handoff to the membership office.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'The snowbird-season engine — campaigns, content and capacity timed to the October-through-April migration, built in the summer quiet and switched on when the flights land.',
      },
    ],
    localAngles: [
      {
        title: 'El Paseo intent',
        body:
          'The corridor draws shoppers who have already decided to spend; the question is where. The capture architecture treats El Paseo as the luxury destination it is — and makes your door the obvious one to walk through.',
      },
      {
        title: 'The snowbird swing',
        body:
          'Population and demand swell from October through April. Campaigns and capacity planning are built around the migration, not the census.',
      },
      {
        title: 'Anchored by institutions',
        body:
          'College of the Desert, the McCallum Theatre, the Living Desert, Eisenhower Health up the road — the mid-valley runs on institutions. Businesses adjacent to them inherit their trust, if the systems are built to carry it.',
      },
      {
        title: 'Club & community networks',
        body:
          'Business here moves through clubs, associations and the charity-season circuit. The growth systems are designed to compound inside those networks — referrals, events, partnerships.',
      },
    ],
    faq: [
      {
        q: 'Do you work with El Paseo retailers?',
        a:
          'Yes — luxury retail positioning, clienteling systems and corridor capture are exactly the work. The standard the street sets is the standard the site has to meet.',
      },
      {
        q: 'Can you help a club or resort improve the member experience?',
        a:
          'Yes — onboarding, concierge agents, communications and retention systems. Membership economics reward small retention improvements enormously; the systems are built to find them.',
      },
      {
        q: 'What professional firms do you work with here?',
        a:
          'Wealth managers, attorneys, medical and dental practices, real-estate teams — the expertise businesses of the mid-valley. Authority content and intake systems are the usual starting point.',
      },
      {
        q: 'How do you handle the seasonal swing?',
        a:
          'By planning against it explicitly. The content calendar, the campaign budget and the staffing automation all follow the October-to-April rhythm — built in the quiet, spent in the season.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Palm Desert.',
      body:
        'Tell us where the mid-valley market is heading for you. We will map the shortest honest path there.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'indio',
    crumbLabel: 'Indio',
    eyebrow: 'Regions — Indio',
    city: 'Indio',
    region: 'Coachella Valley, California',
    titleLines: ['AI-native consulting', 'in Indio.'],
    lede:
      'Strategy, agents and growth systems for Indio — the City of Festivals, the valley’s date capital, and one of its fastest-growing year-round communities.',
    stats: [
      {
        value: '$700M',
        label:
          'Combined annual local impact of Coachella and Stagecoach, 2025 (Office of the Governor)',
      },
      {
        value: '250K',
        label:
          'Coachella visitors across two weekends, 2025 (Office of the Governor)',
      },
      {
        value: '$813M',
        label: 'Visitor spending in Indio, 2024 (Tourism Economics)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Festival-economy capture',
        body:
          'When April arrives at the Empire Polo Club, search demand multiplies overnight and foot traffic doubles or triples. Capture systems are built and staged long before the gates open.',
      },
      {
        index: '02',
        title: 'Growth-market positioning',
        body:
          'Indio’s population has more than doubled since 2000. New residents search before they ask — local capture gets you found first, and the first provider found tends to stay found.',
      },
      {
        index: '03',
        title: 'Home-services & trade systems',
        body:
          'New rooftops mean new demand for the trades. Map-pack capture, voice answering and review operations win the first job — and the repeat customers that follow.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, built for the growth curve.',
      body:
        'Indio is the valley’s growth story — festival weekends at the Empire Polo Club on one side, new neighborhoods rising on the other, date groves older than the city itself holding the east. Cato engagements here start with the market mapped as it is: event-driven demand, east-valley search behavior, the trade and service economy growing into the new rooftops. No local office — embedded research, scheduled on-sites, and systems engineered for the terrain.',
      bullets: [
        'Festival & event capture',
        'New-resident search capture',
        'Home-services systems',
        'Voice AI answering',
        'Review & reputation operations',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Growth & Distribution',
        example:
          'Festival-week surge capture — event-timed pages, campaigns and inventory staged months ahead of Coachella and Stagecoach, plus the February Date Festival and December’s Tamale Festival the competitors forget.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Answering at festival volume — voice AI that books, routes and reassures at 1am on festival weekends and 2pm on a quiet Tuesday alike, in English and Spanish.',
      },
      {
        practice: 'Digital Products',
        example:
          'Ordering, booking and check-in flows engineered for the weekend when traffic triples — fast on overloaded networks, clear to a first-time visitor, honest about wait times.',
      },
      {
        practice: 'Operations & Automation',
        example:
          'Review and reputation operations for a market adding rooftops — systematic review capture that turns one good season into durable map-pack authority.',
      },
    ],
    localAngles: [
      {
        title: 'Event-week intent',
        body:
          'Festival weeks flood the zone with visitors searching for food, lodging and services. Event-timed pages and campaigns catch the surge — and accurate hours and schema keep it.',
      },
      {
        title: 'East-valley local SEO',
        body:
          'Indio and the east valley are under-served by polished local marketing — which makes the beachhead cheaper to take and easier to hold.',
      },
      {
        title: 'The calendar is longer than April',
        body:
          'The Riverside County Fair & National Date Festival packs February, the Tamale Festival closes December, polo season runs between. The event economy has a second and third act most competitors ignore.',
      },
      {
        title: 'Community partnerships',
        body:
          'Growth here runs through schools, sports, the fairgrounds and civic events. Systems are built to convert community presence into durable local search authority.',
      },
    ],
    faq: [
      {
        q: 'How early should we prepare for Coachella and Stagecoach?',
        a:
          'Months, not weeks. Pages, campaigns and booking capacity are staged well before the surge — search authority does not get built the weekend of the event. Fall is not too early.',
      },
      {
        q: 'Can you help us capture the new residents moving in?',
        a:
          'That is the growth play here: new-rooftop intent, “near me” searches from people with no loyalties yet. Map-pack capture, review operations and a site that answers plainly win the first decade of a customer.',
      },
      {
        q: 'Do you work with agriculture or food businesses?',
        a:
          'Yes — the east valley’s date and specialty-crop economy has real direct-to-consumer and agritourism upside. Brand, e-commerce and visit-intent capture translate directly.',
      },
      {
        q: 'What happens when festival season ends?',
        a:
          'The machinery keeps working. The same systems that catch the surge handle the steady state — and the off-season is when the next stage of the build ships.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Indio.',
      body:
        'Tell us what the festival calendar and the growth curve do to your business. We will build for both.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'san-bernardino',
    crumbLabel: 'San Bernardino',
    eyebrow: 'Regions — San Bernardino',
    city: 'San Bernardino',
    region: 'Inland Empire, California',
    titleLines: ['AI-native consulting', 'in San Bernardino.'],
    lede:
      'AI-native consulting for San Bernardino — strategy, systems and growth for the logistics, institutional and service businesses at the Inland Empire’s crossroads, in a market deciding what comes after the warehouse boom.',
    stats: [
      {
        value: '4,000+',
        label:
          'Warehouses across the Inland Empire, roughly 40 square miles, 2025 (UC Riverside / CalMatters)',
      },
      {
        value: '~20%',
        label:
          'Of county wage-and-salary jobs now in logistics, 2025 (Claremont McKenna analysis)',
      },
      {
        value: '$1.5B',
        label:
          'Economic impact of the AllianceCalifornia hub at the former Norton AFB, 2024–25 (IVDA)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Logistics & B2B systems',
        body:
          'The Inland Empire moves the region’s goods, and this county carries the largest share of that employment. Positioning, sales-enablement content and workflow automation for the companies doing the moving — and the ones serving them.',
      },
      {
        index: '02',
        title: 'Healthcare & education anchors',
        body:
          'CSUSB, the county seat, the hospitals up the 215 — the city’s institutions employ thousands and serve more. Intake, scheduling and communication systems built for scale and scrutiny.',
      },
      {
        index: '03',
        title: 'Value-market growth',
        body:
          'San Bernardino rewards businesses that answer reliably. Voice AI, local capture and review operations build trust where word travels fast and price honesty wins.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, Inland-Empire wide.',
      body:
        'San Bernardino is a working city at a crossroads — logistics along the 10 and the 215, the AllianceCalifornia trade hub rising from the old Norton air base, anchor institutions, neighborhoods that reward reliability over polish. Engagements start with that reality mapped: the Inland Empire’s search behavior, the competitive set, the institutional anchors — and, honestly, which parts of the economy are growing and which are not. Then the build is engineered for it. No local office; embedded research and on-sites when they help.',
      bullets: [
        'Regional & corridor capture',
        'B2B positioning & sales systems',
        'Intake & scheduling automation',
        'Voice AI answering',
        'Review & trust operations',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Strategy & Transformation',
        example:
          'Positioning for the post-boom mix — logistics employment peaked in 2022 and is normalizing under automation and warehouse moratoria. The strategy work maps which demand survives, and moves you into it deliberately.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'B2B pipeline for the corridor — 3PLs, carriers, industrial services and suppliers sell on trust and response time. Sales-enablement content and corridor capture make the phone ring with the right freight.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Voice AI for high-volume local services — every call answered: quotes, scheduling, status, with a clean handoff to a person when the job needs one.',
      },
      {
        practice: 'Operations & Automation',
        example:
          'Intake, dispatch and scheduling automation for lean teams serving a big county — quotes, appointments and follow-ups that keep moving without adding headcount.',
      },
    ],
    localAngles: [
      {
        title: 'Inland-Empire intent',
        body:
          'Search behavior here is practical: price, availability, reliability. The content architecture answers plainly and ranks for the questions actually asked.',
      },
      {
        title: 'Regional capture',
        body:
          'San Bernardino sits at the crossroads of the 10 and the 215, with the 210 and the Cajon Pass funneling the rest. The capture strategy spans the Inland Empire, not just the city limits.',
      },
      {
        title: 'Institutional adjacency',
        body:
          'Engagements often connect to the anchor institutions — CSUSB, the county, the medical corridor — where workforce, training and supplier relationships let systems work compound.',
      },
      {
        title: 'A market in transition',
        body:
          'The logistics surge is normalizing — automation, moratoria and shifting port traffic are reshaping the base. Transition markets are where early movers buy attention cheaply, before the next mix settles.',
      },
    ],
    faq: [
      {
        q: 'Do you work with logistics and B2B companies?',
        a:
          'Yes — positioning, sales-enablement content and workflow automation translate directly. The evidence phase maps your buyers and how they actually search, from corridor shippers to local contracts.',
      },
      {
        q: 'Can you help a local service business stand out here?',
        a:
          'That is the core play: answer every call, rank for the practical questions, run the reviews. In a price-sensitive market, reliability is the differentiator that compounds.',
      },
      {
        q: 'What about healthcare or education-adjacent businesses?',
        a:
          'Yes — intake, scheduling and communication systems built for scale and scrutiny, plus the authority content that makes expertise findable.',
      },
      {
        q: 'Is now a good time to invest in marketing here?',
        a:
          'Honest answer: transition markets favor the early. While competitors wait for the old economy to come back, the capture systems get built against the economy that is actually arriving.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in San Bernardino.',
      body:
        'Tell us what the Inland Empire market looks like from where you stand. We will map it properly.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'big-bear',
    crumbLabel: 'Big Bear',
    eyebrow: 'Regions — Big Bear',
    city: 'Big Bear',
    region: 'San Bernardino Mountains, California',
    titleLines: ['AI-native consulting', 'in Big Bear.'],
    lede:
      'Strategy, agents and growth systems for Big Bear — engineered for a mountain economy of two peak seasons, Thursday-evening escape plans, and a lake that doubles as a business model.',
    stats: [
      {
        value: '~1M',
        label:
          'Annual visitors to Big Bear Lake — for a town of about 5,000, 2021 (Tourism Economics)',
      },
      {
        value: '$437M',
        label: 'Visitor spending in Big Bear Lake, 2021 (Tourism Economics)',
      },
      {
        value: '77%',
        label:
          'Of visitor spending flows through vacation rentals, 2021 (Tourism Economics)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Two-season capture',
        body:
          'Ski season and lake season are two different businesses with two different customers. Search, packaging and booking systems are engineered for both peaks — and the shoulder between.',
      },
      {
        index: '02',
        title: 'Cabin & rental economics',
        body:
          'More than three-quarters of visitor spending flows through vacation rentals, and direct booking is the margin. Flagship rental sites, guest concierge and repeat-stay automation cut the platform tax.',
      },
      {
        index: '03',
        title: 'Small-team leverage',
        body:
          'Mountain businesses run lean. Voice AI and workflow automation cover the phones and the follow-up while the team covers the guests.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, timed to the mountains.',
      body:
        'Big Bear runs on the weekend and the season — Snow Summit and Bear Mountain on one side, the lake and the Village on the other, and the long shoulders in between. Engagements start with that calendar mapped: who searches, when they book, what the shoulder months can carry. The build is engineered around the rhythm. No mountain office; embedded research and on-sites when the work warrants them.',
      bullets: [
        'Two-season capture architecture',
        'Direct-booking systems',
        'Cabin & rental marketing',
        'Voice AI & guest concierge',
        'Local & village-area SEO',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Digital Products',
        example:
          'Direct-booking engines for cabins and lodges — real availability, honest pricing and photography that sells the view, built to win the booking back from the platforms one repeat guest at a time.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Guest concierge and after-hours voice AI — lift status, snow conditions, check-in instructions, where to rent skis, answered instantly in the property’s voice.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'Two-season search architecture — ski-cabin intent and lake-weekend intent are different customers on different calendars: separate capture, one unified brand, Oktoberfest bridging the fall.',
      },
      {
        practice: 'Operations & Automation',
        example:
          'Repeat-stay and owner-relations automation — post-stay follow-up, anniversary triggers and owner reporting that keep calendars full and owners calm.',
      },
    ],
    localAngles: [
      {
        title: 'Weekend-intent searches',
        body:
          'Demand is planned midweek for the weekend. The capture architecture is timed to how escapes are actually booked — Thursday urgency, not annual averages.',
      },
      {
        title: 'Village & slopes SEO',
        body:
          'Searches cluster around the Village, Snow Summit, Bear Mountain and the lake itself. Local pages are built for the geography guests actually use.',
      },
      {
        title: 'The two calendars',
        body:
          'Lifts run roughly mid-December to mid-March; the lake runs Memorial Day to Labor Day; Oktoberfest fills the fall weekends. The shoulder months are where margin — and maintenance — hide.',
      },
      {
        title: 'Local operator network',
        body:
          'Referrals move between outfitters, marinas, rental managers and restaurants. Systems are designed to make those partnerships visible and bookable online.',
      },
    ],
    faq: [
      {
        q: 'Can you cut our dependence on Airbnb and Vrbo?',
        a:
          'Partly — and partly is worth a lot. Direct-booking experiences, repeat-stay automation and guest relationships you own. The platform tax is usually the largest recoverable margin in the mountains.',
      },
      {
        q: 'How do you handle both ski and summer seasons?',
        a:
          'As two businesses sharing one brand: separate intent capture, separate packaging, one booking and guest system underneath — plus explicit work on the shoulders, where the margin hides.',
      },
      {
        q: 'Do you work with restaurants and outfitters, not just rentals?',
        a:
          'Yes — the lake-and-slopes economy is interconnected. Map capture, reservations and the referral web between operators matter as much as any single site.',
      },
      {
        q: 'What can the shoulder seasons actually carry?',
        a:
          'More than owners assume — remote-work stays, events, locals’ getaways — but not everything. We model it honestly and build for what the calendar can realistically hold.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Big Bear.',
      body:
        'Tell us what the season does to your business. We will build the system that carries both peaks.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'los-angeles',
    crumbLabel: 'Los Angeles',
    eyebrow: 'Regions — Los Angeles',
    city: 'Los Angeles',
    region: 'California',
    titleLines: ['AI-native consulting', 'in Los Angeles.'],
    lede:
      'AI-native consulting for Los Angeles — brand, product, agents and growth for companies competing in the most design-literate market in the country, neighborhood by neighborhood, with the world’s biggest events on the runway.',
    stats: [
      {
        value: '49.5M',
        label:
          'Visitors to Los Angeles, 2025 (Los Angeles Tourism / Tourism Economics)',
      },
      {
        value: '543K',
        label:
          'Jobs supported by the visitor economy, 2024 (Los Angeles Tourism)',
      },
      {
        value: '3',
        label:
          'Global mega-events on the runway — World Cup 2026, Super Bowl LXI, LA28 (Los Angeles Tourism, 2026)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Brand in a brand town',
        body:
          'Los Angeles has the highest design literacy of any market in the country — and the production industry’s contraction has made the survivors sharper. Brand and experience work here is built to survive that judgment.',
      },
      {
        index: '02',
        title: 'Neighborhood-scale capture',
        body:
          'LA is a hundred markets wearing one name. Search and local strategy are built neighborhood by neighborhood — Silver Lake is not Sherman Oaks, and the Westside is its own planet.',
      },
      {
        index: '03',
        title: 'DTC & creative-industry systems',
        body:
          'From DTC brands to production-adjacent services, LA companies live on story and speed. Cato builds both into the operating system.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, neighborhood by neighborhood.',
      body:
        'LA is a hundred markets wearing one name — and it judges presentation harder than anywhere else in the country. Engagements start with the specific terrain mapped: the neighborhoods that matter, the category’s competitive set, the audience’s actual standard. Then the build is engineered to it — with the 2026–2028 events runway factored into the timing. No LA office; embedded research and on-sites across the basin.',
      bullets: [
        'Neighborhood intent architecture',
        'Brand & identity systems',
        'Flagship web experiences',
        'AI agents & concierge',
        'Answer-engine visibility',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Brand & Creative',
        example:
          'Identity that survives the LA standard — thesis, archetype, narrative and system, strong enough to hold from a Silver Lake popup to a national shelf.',
      },
      {
        practice: 'Digital Products',
        example:
          'Flagship commerce for DTC brands — story-driven storefronts with subscription economics and editorial-grade art direction, built for buyers who bounce in 400 milliseconds.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'Neighborhood-scale search capture — intent architecture mapped to the geography people actually live in, expanded beachhead by beachhead.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Answer-engine and concierge systems — content and schema built to be cited by the agents doing the shortlisting, and voice agents that sound like the brand.',
      },
    ],
    localAngles: [
      {
        title: 'Neighborhood intent',
        body:
          'Angelenos search by neighborhood, not by city. The intent architecture maps to the geography people actually live in.',
      },
      {
        title: 'Answer-engine visibility',
        body:
          'In a market this dense, AI-mediated discovery matters early. Content and schema are built to be cited by the agents doing the shortlisting.',
      },
      {
        title: 'The events runway',
        body:
          'World Cup in 2026, Super Bowl LXI in 2027, the Olympics in 2028. Demand will arrive in global waves; the businesses positioned early inherit the surge — and positioning takes quarters, not weeks.',
      },
      {
        title: 'Creative partnerships',
        body:
          'Engagements plug into LA’s creative bench — photographers, directors, stylists, production designers — with Cato running strategy, systems and build.',
      },
    ],
    faq: [
      {
        q: 'How do you choose which neighborhood to start in?',
        a:
          'On evidence: search volume, competitive density, ticket size and where your best customers already cluster. LA rewards focus — the beachhead is chosen deliberately, then expanded the same way.',
      },
      {
        q: 'Do you work with DTC brands?',
        a:
          'Yes — flagship commerce, subscription systems, brand narrative and the agent layer on top. LA DTC is crowded; the build is what separates a brand from a theme.',
      },
      {
        q: 'Should we be preparing for the 2026–2028 events?',
        a:
          'Yes, and the window is now. World Cup, Super Bowl and Olympic demand will reward the businesses whose capture systems are already ranking when the world arrives.',
      },
      {
        q: 'What does an engagement look like for an LA company?',
        a:
          'Embedded and remote-first: the neighborhood and category mapped first, working sessions across the basin when they count, and a build cadence matched to product velocity.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Los Angeles.',
      body:
        'Tell us the neighborhood and the category. We will show you the beachhead worth taking first.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'orange-county',
    crumbLabel: 'Orange County',
    eyebrow: 'Regions — Orange County',
    city: 'Orange County',
    region: 'California',
    titleLines: ['AI-native consulting', 'in Orange County.'],
    lede:
      'AI-native consulting for Orange County — strategy, agents and growth systems for a $16-billion visitor economy, the Irvine tech corridor, and thirty-four cities that each search differently.',
    stats: [
      {
        value: '$16.3B',
        label: 'Visitor spending in Orange County, 2024 (Visit California)',
      },
      {
        value: '26.5M',
        label: 'Visitors to Anaheim alone in 2025, a record (Visit Anaheim)',
      },
      {
        value: '39,000+',
        label:
          'Life-science jobs countywide, 2024 (OC Economic Opportunity Report)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'The Irvine corridor',
        body:
          'Broadcom, Edwards Lifesciences, Blizzard, Anduril up the 5 — the county’s tech and med-device core sells to technical buyers. Narrative, docs-grade content and product-led web built for them.',
      },
      {
        index: '02',
        title: 'The appointment economy',
        body:
          'Trades, dental, med spa, wellness — across thirty-four cities, the booking flow is the business. Instant voice answering, recall automation and review operations win the repeat customer.',
      },
      {
        index: '03',
        title: 'Coastal hospitality at record scale',
        body:
          'Anaheim just posted its biggest tourism year ever, and the beach cities run full from spring break to the holidays. Capture, booking and guest systems engineered for the wave.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, city by city.',
      body:
        'Orange County is thirty-four cities sharing a name — a tech corridor in Irvine, a convention engine in Anaheim, surf-and-stay hospitality along the coast, and appointment businesses filling the master plans in between. Engagements start with the patchwork mapped: city-level search behavior, the category’s competitive set, the communities where reputation actually travels. The build follows the map. No OC office; embedded research and on-sites when they help.',
      bullets: [
        'City-by-city local capture',
        'B2B & med-device narrative',
        'Practice & appointment systems',
        'Hospitality & event capture',
        'Bilingual search & content',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Strategy & Transformation',
        example:
          'Market-entry and positioning for the city you are actually in — an Irvine B2B play reads nothing like a Newport Beach consumer one.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Voice AI that answers every call during a Honda Center event weekend; concierge agents that handle booking questions in English and Spanish.',
      },
      {
        practice: 'Digital Products',
        example:
          'Booking flows, patient portals and quote engines that hold up to the county’s comparison-shopping standard.',
      },
      {
        practice: 'Brand & Creative',
        example:
          'Identity work that survives next to South Coast Plaza presentation — and med-device brands that survive an engineer’s read.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'City-by-city local SEO across the patchwork, timed to convention and tourism waves instead of the annual average.',
      },
      {
        practice: 'Operations & Automation',
        example:
          'Recall, rebooking and review operations that keep the appointment book full without adding front-desk headcount.',
      },
    ],
    localAngles: [
      {
        title: 'City-by-city intent',
        body:
          'Irvine is not Santa Ana is not Newport Beach. Capture is built per city — the county rewards specificity and punishes the generic.',
      },
      {
        title: 'The bilingual market',
        body:
          'A third of the county speaks Spanish at home, and Santa Ana runs majority-Spanish. Search, content and voice agents are built for both languages from the start.',
      },
      {
        title: 'Master-planned search behavior',
        body:
          'Residents search by tract, village and school district — Woodbridge, not “Irvine.” The local architecture maps to how people actually describe where they live.',
      },
      {
        title: 'Convention & event waves',
        body:
          'NAMM, VidCon, BlizzCon and the run-up to the 2028 Games spike demand overnight. Campaigns and capacity are staged months ahead of the wave.',
      },
    ],
    faq: [
      {
        q: 'Do you have an office in Orange County?',
        a:
          'No — Cato is remote-first. We work embedded: deep research into your city and category, scheduled time on-site when it helps, and systems that run without geography.',
      },
      {
        q: 'What Orange County businesses do you work with?',
        a:
          'Irvine-corridor tech and med-device, home services, dental and med spa, coastal hospitality, real estate and consumer brands across the county’s cities.',
      },
      {
        q: 'Do you work with B2B and technical companies?',
        a:
          'Yes — category narrative, technical content systems and product-led web for the corridor’s engineering-literate buyers is a core practice here.',
      },
      {
        q: 'Can you capture the Spanish-speaking market?',
        a:
          'Yes — bilingual intent architecture, content and voice agents. In much of the county it is not a niche; it is half the market.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Orange County.',
      body:
        'Tell us the cities you compete in. We will build the capture city by city.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'san-francisco',
    crumbLabel: 'San Francisco',
    eyebrow: 'Regions — San Francisco',
    city: 'San Francisco',
    region: 'California',
    titleLines: ['AI-native consulting', 'in San Francisco.'],
    lede:
      'AI-native consulting for San Francisco — category narrative, agent systems and product-led experience from the city that now sets the global AI agenda, for buyers who discount adjectives and read the docs.',
    stats: [
      {
        value: '60%',
        label:
          'Share of global AI venture funding captured by the Bay Area, 2025 (Crunchbase / HumanX)',
      },
      {
        value: '23.7M',
        label: 'Visitors to San Francisco in 2025 (San Francisco Travel)',
      },
      {
        value: '$9.4B',
        label: 'Visitor spending in 2025, nearing the 2019 record (SF Travel)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Narrative for skeptical buyers',
        body:
          'SF buyers have seen every pitch — including, lately, every AI pitch. Category narrative and product-led storytelling built for an audience that discounts adjectives and reads the docs.',
      },
      {
        index: '02',
        title: 'Agent-native products',
        body:
          'This is the city building the agents. Voice AI, generative UI and concierge systems engineered to survive a demo in front of the people who ship the frontier models.',
      },
      {
        index: '03',
        title: 'Hospitality in recovery',
        body:
          'Moscone’s calendar is filling again and visitor spending is closing on its 2019 record. Hotels, restaurants and neighborhood businesses need capture systems ready for the rebound, not the obituary.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, at product velocity.',
      body:
        'The Bay Area now takes the majority of the world’s AI venture capital, and the city’s buyers are the people building it. Engagements here start with the category mapped — the narrative competitors are circling, the technical proof buyers expect, the velocity the roadmap demands — and with the recovery in hospitality and neighborhood retail read just as carefully. The build is engineered to that standard. No SF office; embedded research and working sessions when they count.',
      bullets: [
        'Category design & narrative',
        'Product-led web experience',
        'Voice AI & generative UI',
        'Agent-assisted operations',
        'Hospitality & neighborhood capture',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Strategy & Transformation',
        example:
          'Category design decided on evidence — naming and owning the category before the well-funded competitor three blocks away does.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Voice AI and generative UI held to a Cerebral Valley standard: real agents, evaluated, instrumented — not a chatbot with a landing page.',
      },
      {
        practice: 'Digital Products',
        example:
          'Product-led sites, interactive docs and demo environments where the engineering surface is part of the brand.',
      },
      {
        practice: 'Brand & Creative',
        example:
          'Identity that reads as confident to a design-literate, adjective-allergic audience — from SoMa SaaS to Ferry Building retail.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'Technical content systems and answer-engine visibility, plus local capture for the neighborhoods the recovery is reaching first.',
      },
      {
        practice: 'Operations & Automation',
        example:
          'Agent-assisted back office for lean venture-backed teams — coverage and follow-up without the headcount plan.',
      },
    ],
    localAngles: [
      {
        title: 'Category-first discovery',
        body:
          'Buyers here shortlist from the category narrative. The strategy work names the category and owns its language before competitors do.',
      },
      {
        title: 'Technical credibility signals',
        body:
          'Docs, changelogs, performance budgets, evals — in SF, the engineering surface is part of the brand. The build treats it that way.',
      },
      {
        title: 'The AI capital’s bar',
        body:
          'With most of the world’s AI funding landing in this metro, “we added a chatbot” is not a pitch. Agent work is scoped, benchmarked and honest about limits.',
      },
      {
        title: 'Convention-calendar timing',
        body:
          'Dreamforce, RSA and the AI conference circuit concentrate demand into weeks. Hospitality and event-adjacent capture is staged to the Moscone calendar.',
      },
    ],
    faq: [
      {
        q: 'Do you have an office in San Francisco?',
        a:
          'No — Cato is remote-first. We work embedded: deep research into your category and buyers, working sessions when they count, and systems that run without geography.',
      },
      {
        q: 'What San Francisco businesses do you work with?',
        a:
          'SaaS and AI startups, venture-backed consumer products, technical services — and the hospitality and neighborhood businesses riding the city’s recovery.',
      },
      {
        q: 'Can you keep pace with a venture-backed roadmap?',
        a:
          'Yes — short cycles, shipped increments, explicit trade-offs. The engagement model was built around product velocity, not agency timelines.',
      },
      {
        q: 'Do you only work with tech companies here?',
        a:
          'No. The same systems discipline applies to hotels, restaurants and retail as visitor spending closes back in on its 2019 record.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in San Francisco.',
      body:
        'Bring us the narrative problem your roadmap keeps circling. We will decide it on evidence.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'napa',
    crumbLabel: 'Napa',
    eyebrow: 'Regions — Napa',
    city: 'Napa',
    region: 'Wine Country, California',
    titleLines: ['AI-native consulting', 'in Napa.'],
    lede:
      'AI-native consulting for Napa — brand, direct-to-consumer and guest-experience systems for a valley where the club is the business and retention just became the whole game.',
    stats: [
      {
        value: '$2.2B',
        label: 'Visitor spending in Napa County, 2025 (Visit Napa Valley)',
      },
      {
        value: '53%',
        label:
          'Share of the average winery’s sales via tasting rooms + clubs (SVB, 2026)',
      },
      {
        value: '15,300',
        label:
          'Tourism-supported jobs — roughly one in seven in the county (2025)',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Wine hospitality positioning',
        body:
          'Hundreds of tasting rooms, one valley. Story, identity and experience systems that make the visit worth planning — the average overnight guest spends $771 a day deciding where to go.',
      },
      {
        index: '02',
        title: 'The retention squeeze',
        body:
          'Napa runs the country’s largest average wine clubs — and attrition has outrun sign-ups for two straight years. Club onboarding, reactivation and member experience systems are now the highest-leverage work in the valley.',
      },
      {
        index: '03',
        title: 'Guest-experience automation',
        body:
          'Tasting bookings, concierge questions, itinerary help — answered instantly in the house voice, escalated to the host when it matters.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, fluent in wine hospitality.',
      body:
        'The valley sells considered experiences, and its economics run on direct relationships: tasting rooms and clubs now carry the majority of the average winery’s revenue. Engagements start with the market mapped — tasting-intent search, club economics, the referral web between wineries, hotels and restaurants from Calistoga to American Canyon. The build is engineered for the valley’s rhythm. No Wine Country office; embedded research and on-sites timed to the season.',
      bullets: [
        'Tasting & visit-intent capture',
        'DTC wine & club systems',
        'Club retention & reactivation',
        'Guest concierge agents',
        'Hospitality partnership capture',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Strategy & Transformation',
        example:
          'Club economics and DTC mix decisions made on evidence — what to fix first when visitation is soft and attrition is not.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'A concierge that answers “can we bring our dog to the terrace?” at 11pm in the house voice, books the tasting, and knows when to hand to the host.',
      },
      {
        practice: 'Digital Products',
        example:
          'Allocation, club and booking flows built for long relationships — not checkout funnels borrowed from commodity e-commerce.',
      },
      {
        practice: 'Brand & Creative',
        example:
          'Story systems for estates where the label, the room and the site must read as one considered experience.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'Tasting-intent capture by varietal, town and occasion — converting the 62% of visitors who currently day-trip and leave.',
      },
      {
        practice: 'Operations & Automation',
        example:
          'Reactivation campaigns, shipment-touch automation and host-alert workflows that keep club members past the two-year cliff.',
      },
    ],
    localAngles: [
      {
        title: 'Tasting-intent searches',
        body:
          'Visitors plan by varietal, by town, by experience — “cabernet tasting Yountville,” not “wine Napa.” The intent architecture catches the planning searches, not just the drive-bys.',
      },
      {
        title: 'Five towns, five markets',
        body:
          'Calistoga, St. Helena, Yountville, Napa, American Canyon — each is its own market with its own visitor. Local pages are built for the valley’s actual geography.',
      },
      {
        title: 'The club retention gap',
        body:
          'Napa was the only major region where club attrition beat acquisition in 2025. The work that matters most now is keeping members, not just signing them.',
      },
      {
        title: 'The hospitality web',
        body:
          'Referrals flow between wineries, hotels and restaurants. The systems make those relationships visible, bookable and measurable — the valley runs on them.',
      },
    ],
    faq: [
      {
        q: 'Do you have an office in Napa?',
        a:
          'No — Cato is remote-first. We work embedded: deep research into the valley market, on-sites timed to the season, and systems that run without geography.',
      },
      {
        q: 'What Napa businesses do you work with?',
        a:
          'Wineries and tasting rooms, hotels and inns, restaurants, and the experience businesses around them.',
      },
      {
        q: 'Do you work with wineries and tasting rooms?',
        a:
          'Yes — positioning, DTC and club systems, and guest-experience automation. The work respects the valley’s hospitality standards and its allocation economics.',
      },
      {
        q: 'Our club is losing members faster than we sign them. Can you help?',
        a:
          'That is the defining problem in the valley right now. Onboarding, reactivation, member-experience and shipment-touch systems are built for exactly it.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Napa.',
      body:
        'Tell us how guests find and book you today. We will build the system that makes it direct.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'phoenix',
    crumbLabel: 'Phoenix',
    eyebrow: 'Regions — Phoenix',
    city: 'Phoenix',
    region: 'Arizona',
    titleLines: ['AI-native consulting', 'in Phoenix.'],
    lede:
      'AI-native consulting for Phoenix — strategy, agents and growth systems for a metro adding eighty-five thousand residents a year and landing the largest foreign investment in American history.',
    stats: [
      {
        value: '+85,000',
        label:
          'Net new metro residents in a single year, 2023→2024 (Greater Phoenix)',
      },
      {
        value: '$165B',
        label:
          'TSMC’s planned Arizona investment — the largest single foreign direct investment in U.S. history (2025)',
      },
      {
        value: '4.8M',
        label: 'Metro population, 2025 — and climbing',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Growth-market capture',
        body:
          'Tens of thousands of new residents a year, each one a fresh set of “best” and “near me” searches with no loyalty yet. Capture systems get you found before the market gets crowded.',
      },
      {
        index: '02',
        title: 'The semiconductor gravity',
        body:
          'TSMC’s $165-billion build and Intel’s Chandler campus are pulling a supplier ecosystem into the Valley. B2B positioning and sales systems for the companies selling into it.',
      },
      {
        index: '03',
        title: 'Trades & heat economics',
        body:
          'Heat is a business model: HVAC, pool, solar. Map-pack capture, voice answering and review operations for the trades the desert keeps busiest exactly when the phones melt.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, built for a market in motion.',
      body:
        'Phoenix is adding people faster than almost anywhere in the country, and every arrival resets the local search race — while the semiconductor build rewires the B2B landscape around it. Engagements start with the motion mapped: new-resident intent, the trades’ competitive set, the Valley’s city-by-city patchwork, the supplier gravity of the fab corridor. The build is engineered for it. No Phoenix office; embedded research and on-sites when they help.',
      bullets: [
        'New-resident capture',
        'Home-services growth systems',
        'Semiconductor-corridor B2B',
        'Practice & appointment growth',
        'Voice AI answering',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Strategy & Transformation',
        example:
          'Beachhead selection in a metro adding a city’s worth of people a year — which suburbs, which categories, in which order.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Voice AI that answers every call during a 115° week — the surge weeks are exactly when the trades’ phones go unanswered.',
      },
      {
        practice: 'Digital Products',
        example:
          'Quote engines, booking flows and supplier portals built for buyers who just moved here and have no referrals yet.',
      },
      {
        practice: 'Brand & Creative',
        example:
          'Identity for companies selling into the fab corridor — credible to engineers, legible to procurement.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'City-by-city capture across Phoenix, Scottsdale, Tempe, Mesa, Chandler — timed to moving season and summer spike, not the annual average.',
      },
      {
        practice: 'Operations & Automation',
        example:
          'Dispatch follow-up, review operations and recall automation that keep pace with a book that grows every month.',
      },
    ],
    localAngles: [
      {
        title: 'New-resident intent',
        body:
          'People search differently when they are new: “best,” “near me,” no loyalty yet. The capture architecture is built for a market in motion.',
      },
      {
        title: 'Valley-wide local SEO',
        body:
          'Phoenix, Scottsdale, Tempe, Mesa, Chandler — the Valley of the Sun is a patchwork. Local strategy is built city by city, then unified.',
      },
      {
        title: 'The fab corridor',
        body:
          'The TSMC and Intel build-outs are attracting dozens of suppliers. B2B search and content catch the companies — and the talent — arriving with them.',
      },
      {
        title: 'Summer-season economics',
        body:
          'The summer slows some businesses and spikes others. Campaign and capacity systems are timed to the desert calendar, not the fiscal one.',
      },
    ],
    faq: [
      {
        q: 'Do you have an office in Phoenix?',
        a:
          'No — Cato is remote-first. We work embedded: deep research into the Valley’s markets, scheduled time on-site when it helps, and systems that run without geography.',
      },
      {
        q: 'What Phoenix businesses do you work with?',
        a:
          'Home services, healthcare and dental practices, real estate, semiconductor-ecosystem B2B, and the consumer businesses growing with the metro.',
      },
      {
        q: 'Is the market too crowded already?',
        a:
          'Crowded is an evidence question, not a feeling. The diagnosis maps who actually owns the searches that matter — in a metro adding 85,000 people a year, the gaps reopen constantly.',
      },
      {
        q: 'Do you work with B2B companies selling into the semiconductor build?',
        a:
          'Yes — positioning, technical content and sales-enablement systems for suppliers and services around the fab corridor.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Phoenix.',
      body:
        'Tell us which part of the Valley you are taking. We will build the capture before the crowd arrives.',
      label: 'Start a build',
      href: '/contact',
    },
  },

  {
    slug: 'salt-lake-city',
    crumbLabel: 'Salt Lake City',
    eyebrow: 'Regions — Salt Lake City',
    city: 'Salt Lake City',
    region: 'Utah',
    titleLines: ['AI-native consulting', 'in Salt Lake City.'],
    lede:
      'AI-native consulting for Salt Lake City — category narrative, agent systems and growth for the Silicon Slopes corridor, the fastest-growing state economy in the country, with the Wasatch at its back.',
    stats: [
      {
        value: '67,400',
        label:
          'Utah tech-industry jobs paying $9.3B in wages, 2023 (Utah Dept. of Workforce Services)',
      },
      {
        value: '1,000+',
        label: 'Tech companies along the Wasatch Front (Silicon Slopes)',
      },
      {
        value: '4.5%',
        label:
          'Utah real GDP growth in 2024 — fastest in the nation, on a $308B economy',
      },
    ],
    features: [
      {
        index: '01',
        title: 'Silicon Slopes narrative',
        body:
          'The corridor that produced Qualtrics, Domo and Pluralsight expects real marketing. Category narrative and product-led experience built for a technical, seen-it-before audience.',
      },
      {
        index: '02',
        title: 'SaaS growth systems',
        body:
          'The corridor’s software companies compete nationally from day one. Positioning, pipeline content and agent-assisted operations built to scale past the next funding round.',
      },
      {
        index: '03',
        title: 'The outdoor economy',
        body:
          'The Wasatch is the brand backdrop and the customer base — and the 2034 Winter Games runway is already pulling investment and attention toward it. DTC, retail and experience businesses built for it.',
      },
    ],
    detail: {
      eyebrow: 'Working here',
      title: 'Remote-first, corridor-wide.',
      body:
        'Silicon Slopes runs from Ogden to Provo, with its center of gravity in Lehi, and it runs technical — Utah grew faster than any other state economy in 2024. Engagements start with the corridor mapped: the category narratives in play, the engineering-literate buyers, the outdoor economy on the Wasatch’s doorstep and the Olympic runway beneath it. The build is engineered for that audience. No SLC office; embedded research and on-sites when they count.',
      bullets: [
        'Category & narrative design',
        'SaaS growth systems',
        'Product-led web experience',
        'Agent-assisted operations',
        'DTC & outdoor-economy brands',
        'Measurement & reporting',
      ],
    },
    practiceMap: [
      {
        practice: 'Strategy & Transformation',
        example:
          'Category design for corridor SaaS that has to win nationally — decided on evidence, not on what the last funding announcement sounded like.',
      },
      {
        practice: 'AI Agent Systems',
        example:
          'Sales-assist and support agents a technical buyer cannot embarrass — scoped, evaluated, honest about limits.',
      },
      {
        practice: 'Digital Products',
        example:
          'Product-led sites and interactive docs where the engineering surface carries the pitch.',
      },
      {
        practice: 'Brand & Creative',
        example:
          'Identity for outdoor and DTC brands where the Wasatch is the backdrop and the credibility test.',
      },
      {
        practice: 'Growth & Distribution',
        example:
          'Pipeline content and answer-engine visibility for national competition, plus corridor-local capture that treats Ogden-to-Provo as one market.',
      },
      {
        practice: 'Operations & Automation',
        example:
          'Agent-assisted operations for lean teams scaling headcount slower than revenue — the corridor’s favorite constraint.',
      },
    ],
    localAngles: [
      {
        title: 'Corridor-wide discovery',
        body:
          'The Slopes run from Ogden to Provo, with the gravity in Lehi. Positioning and capture are built for the corridor as one labor and customer market.',
      },
      {
        title: 'Technical-audience content',
        body:
          'Buyers here read docs and changelogs. Content systems are built for engineers and operators, not just marketers.',
      },
      {
        title: 'The Olympic runway',
        body:
          'The 2034 Winter Games are a decade of compounding attention and investment, not an event. Hospitality, retail and experience brands are building for it now.',
      },
      {
        title: 'Community & ecosystem ties',
        body:
          'The Utah tech community is tight — Silicon Slopes events, the venture funds, the operator network. Launches, content and partnerships are designed to compound inside it.',
      },
    ],
    faq: [
      {
        q: 'Do you have an office in Salt Lake City?',
        a:
          'No — Cato is remote-first. We work embedded: deep research into the corridor market, scheduled time on-site when it helps, and systems that run without geography.',
      },
      {
        q: 'What Salt Lake City businesses do you work with?',
        a:
          'SaaS and tech companies, outdoor and DTC brands, professional services, and the consumer businesses along the Wasatch Front.',
      },
      {
        q: 'Do you work with Silicon Slopes SaaS companies?',
        a:
          'Yes — category narrative, product-led experience and agent-assisted operations are core to the practice. The corridor is exactly the audience they were built for.',
      },
      {
        q: 'Do you work with outdoor and hospitality brands?',
        a:
          'Yes — DTC, retail and experience businesses, with the 2034 Games runway treated as a planning horizon rather than a headline.',
      },
    ],
    cta: {
      title: 'Build beyond ordinary in Salt Lake City.',
      body:
        'Tell us the story the corridor has not heard yet. We will make it impossible to miss.',
      label: 'Start a build',
      href: '/contact',
    },
  },
];
