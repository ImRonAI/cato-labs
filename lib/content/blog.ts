/**
 * Blog — copy deck.
 * The journal is a design showcase: one sample article demonstrates the
 * reading experience end to end; further entries are cards marked
 * forthcoming until the owner publishes real essays.
 */

export interface BlogIndex {
  eyebrow: string;
  titleLines: string[];
  lede: string;
}

export interface BlogCard {
  slug: string;
  title: string;
  dek: string;
  date: string;
  readTime: string;
  tags: string[];
  status: 'sample' | 'forthcoming';
}

export interface ArticleSection {
  h: string;
  paras: string[];
  pullQuote?: string;
}

export interface SampleArticle {
  title: string;
  dek: string;
  date: string;
  readTime: string;
  sections: ArticleSection[];
}

export const blogIndex: BlogIndex = {
  eyebrow: 'Journal',
  titleLines: ['Notes from', 'the build.'],
  lede:
    'Essays on strategy, agents, experience and growth — how Cato thinks, written the way Cato works: on evidence, in plain language.',
};

export const posts: BlogCard[] = [
  {
    slug: 'the-anatomy-of-delight',
    title: 'The Anatomy of Delight',
    dek:
      'Why the best interfaces make you feel considered. A design sample of the Cato reading experience.',
    date: 'February 2026',
    readTime: '6 min read',
    tags: ['Experience design', 'AI interfaces', 'Craft'],
    status: 'sample',
  },
  {
    slug: 'the-faq-bot-is-dead',
    title: 'The FAQ Bot Is Dead',
    dek:
      'FAQ bots deflect; concierges resolve. Why persona, knowledge and escalation are the whole game — and what replaces the bot.',
    date: 'Forthcoming',
    readTime: '—',
    tags: ['AI agents', 'Customer experience'],
    status: 'forthcoming',
  },
  {
    slug: 'ai-crawlers-are-your-new-homepage',
    title: 'AI Crawlers Are Your New Homepage',
    dek:
      'The first reader of your site is no longer a person. How agent-mediated discovery changes what a homepage must say — and prove.',
    date: 'Forthcoming',
    readTime: '—',
    tags: ['Search', 'AI discovery', 'Content strategy'],
    status: 'forthcoming',
  },
];

export const sampleArticle: SampleArticle = {
  title: 'The Anatomy of Delight',
  dek:
    'Why the best interfaces make you feel considered. A design sample of the Cato reading experience.',
  date: 'February 2026',
  readTime: '6 min read',
  sections: [
    {
      h: 'Delight is not decoration',
      paras: [
        'Delight has a branding problem. The word suggests confetti — a burst of charm sprinkled over a finished product, optional and slightly unserious. In practice the opposite is true. Delight is what happens when a system notices something about you and acts on it gracefully.',
        'That definition matters because it moves delight from the art department to the engineering plan. It is not a layer applied at the end. It is a property of decisions made early — what the product knows, what it remembers, what it refuses to ask twice.',
      ],
    },
    {
      h: 'Considered is the word',
      paras: [
        'Ask people to describe the interfaces they love and the vocabulary is telling. Nobody says delightful. They say: it remembered my seat. It knew I was in a hurry. It did not make me repeat myself. The common thread is consideration — the feeling of being thought about.',
        'Consideration is a high bar because it cannot be faked at the surface. An interface that feels considered is reporting on systems underneath: state that persists, defaults that reflect reality, copy that answers the question actually being asked.',
      ],
    },
    {
      h: 'Where agents change the texture',
      paras: [
        'Until recently, consideration did not scale. A product could remember preferences, but it could not understand situations. Agents change that. An interface with an agent underneath can read intent in context — and respond with exactly the component, the option, or the human the moment requires.',
        'This is why the best AI interfaces feel less like software and more like good service. The mechanism is new; the standard is old. What changed is that the standard can now be met at software margins, on every visit, for every user — not just the ones a team has time for.',
      ],
      pullQuote:
        'The best interface makes you feel considered before it makes you feel impressed.',
    },
    {
      h: 'The failure mode is theater',
      paras: [
        'For every product that earns delight, a dozen perform it. Confetti on the empty state. A chatbot that says it is thrilled to help, then cannot. Animation where an answer should be. Users read this instantly: the charm is a costume, and the system underneath does not know them at all.',
        'The test is simple. Strip the decoration and ask what the product actually noticed. If the answer is nothing, the delight was theater — and theater erodes trust faster than plainness ever did.',
      ],
    },
    {
      h: 'A standard, not a surprise',
      paras: [
        'The studios known for delightful products do not treat delight as luck. They treat it as a standard: specified in the brief, argued in the review, tested against real moments of use. What looks like taste from the outside is usually discipline from the inside.',
        'That is the Cato position too. Build beyond ordinary does not mean build louder. It means build to the standard where the user feels considered — and then hold that standard on every surface, every time.',
      ],
    },
  ],
};
