/** Draft tour copy and illustrative stories. Owner review required before launch. */
export type JourneyStory = 'enterprise' | 'startup' | 'family' | 'solo';

export const journeyCopy = {
  review: 'Draft copy, pending owner review',
  illustrative: 'Illustrative example, not a real client',
  storyLabel: 'Choose an example business',
  stories: { enterprise: 'Enterprise', startup: 'Startup', family: 'Family business', solo: 'Sole proprietor' },
  openingTitle: 'Your business. Your tour.',
  opening: 'Tell Cato what type of business you run, what it does, and its biggest headache. He will connect every stop to that problem.',
  next: 'Next stop',
  previous: 'Previous stop',
  queued: 'Next stop queued. Take a moment with this example.',
  travelling: 'Cato is on his way.',
  finale: 'A working interface for your story',
  build: 'Build this example',
  building: 'Cato is building...',
  rebuild: 'Build it again',
  close: 'Close',
  djPresets: [{ id: 'lobby', label: 'Lobby loop' }, { id: 'pool', label: 'Pool-deck set' }, { id: 'jingle', label: 'Weekend jingle' }],
  composing: 'Cato is composing...',
  stopAudio: 'Stop',
  voiceOffer: 'Tell me about your business, what it does, and the headache you want to solve. I will show you where agents fit.',
};

export interface JourneyStop {
  id: string;
  eyebrow: string;
  titleLines: [string, string];
  body: string;
  tags: string[];
  stories: Record<JourneyStory, string>;
  logos: string[];
  illustrativeLabel: string;
}

export const journeyStops: JourneyStop[] = [
  {
    id: 'video-call', eyebrow: 'Video call', titleLines: ['Start with', 'a conversation.'],
    body: 'Create a live video room through Telnyx. Cato connects the conversation to the work, with your approval before an outbound action.',
    tags: ['Telnyx video rooms', 'Visitor approval', 'Human handoff'], logos: [], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'An enterprise service team brings a specialist into a customer conversation instead of sending another handoff email.',
      startup: 'A startup founder opens a product conversation with a prospect while the context is still fresh.',
      family: 'A family-run repair business talks through a customer request before arranging the visit.',
      solo: 'An independent consultant moves an inquiry into a video consultation without juggling messages.',
    },
  },
  {
    id: 'music', eyebrow: 'Music & sound', titleLines: ['Give your brand', 'its own sound.'],
    body: 'Cato chooses a genre and mood, then generates music or a sound effect using the existing audio tools. Listen here, without downloads or raw prompt access.',
    tags: ['Original music', 'Sound effects', 'In-page playback'], logos: [], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'The service team explores an instrumental sound bed for a product introduction, without naming an artist or copying lyrics.',
      startup: 'The founder tries a bright electronic soundtrack for the product demo.',
      family: 'The repair shop explores a warm instrumental loop for an introduction to its services.',
      solo: 'The consultant gives a short explainer a calm, focused soundtrack.',
    },
  },
  {
    id: 'asset-gen', eyebrow: 'Image, video & assets', titleLines: ['Make the assets.', 'Keep the direction.'],
    body: 'Generate images and video from a business brief with ElevenLabs Flows. Review the output before using it in a campaign or customer experience.',
    tags: ['Image generation', 'Video generation', 'Creative review'], logos: [], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'The team drafts visual material that explains a complicated service before asking its brand team to review.',
      startup: 'The founder explores launch imagery while the product story is taking shape.',
      family: 'The shop prepares a visual service guide without passing off generated images as real customer work.',
      solo: 'The consultant creates supporting visuals for an explainer instead of starting every asset from scratch.',
    },
  },
  {
    id: 'seo-social', eyebrow: 'SEO & social', titleLines: ['Be easier', 'to discover.'],
    body: 'Research search intent, structure useful pages, and draft social content around the questions customers actually ask. A person reviews what gets published.',
    tags: ['Search research', 'Structured content', 'Social planning'], logos: ['perplexity'], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'The team turns recurring service questions into source-backed pages and a coordinated social plan.',
      startup: 'The founder builds a launch content plan around the problem the product solves.',
      family: 'The shop answers local service questions clearly, with accurate opening hours and coverage.',
      solo: 'The consultant turns specialist knowledge into useful articles rather than generic daily posts.',
    },
  },
  {
    id: 'crm-automation', eyebrow: 'CRM & work automation', titleLines: ['Connect the work.', 'Drop the busywork.'],
    body: 'Move context between your CRM and work tools. Route inquiries, create tasks, and prepare follow-ups, with human decisions kept where they belong.',
    tags: ['CRM integration', 'Task routing', 'Approval steps'], logos: ['hubspot', 'salesforce', 'zoho', 'jira', 'asana', 'linear', 'clickup'], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'The service request becomes an assigned work item with the customer context attached, not another manual copy-and-paste job.',
      startup: 'The founder connects prospect conversations to the CRM and product backlog.',
      family: 'The shop keeps inquiries, estimates, and follow-up tasks together so the next family member can pick up the work.',
      solo: 'The consultant turns an accepted inquiry into a project checklist and a follow-up reminder.',
    },
  },
  {
    id: 'implementations', eyebrow: 'Implementations & fine-tuning', titleLines: ['The right model.', 'Built into your work.'],
    body: 'Choose models for the task, integrate them with your systems, and evaluate their behavior. Fine-tune when your data and the use case justify it, not by default.',
    tags: ['Model selection', 'Evaluation', 'Fine-tuning', 'Unsloth'], logos: ['anthropic', 'openai', 'mistral', 'xai', 'huggingface', 'axolotl'], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'The team evaluates a service assistant against approved examples before connecting it to a production workflow.',
      startup: 'The founder compares models on real product tasks before investing in fine-tuning.',
      family: 'The shop starts with a practical integration and checks whether a tailored model would solve a real gap.',
      solo: 'The consultant tests an assistant against the work they already know how to judge.',
    },
  },
  {
    id: 'lead-support', eyebrow: 'Lead generation & support', titleLines: ['Find the fit.', 'Support the customer.'],
    body: 'Research prospective customers, qualify inbound inquiries, and answer routine support questions. Give a person the sensitive case and the context to handle it.',
    tags: ['Prospect research', 'Lead qualification', 'Support handoff'], logos: ['zendesk', 'intercom'], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'The team separates new opportunities from support cases and routes each to the right owner.',
      startup: 'The founder learns which prospects fit and which support questions need product attention.',
      family: 'The shop asks about the job, location, and urgency before arranging the next conversation.',
      solo: 'The consultant qualifies scope and timing while existing clients still get clear answers.',
    },
  },
  {
    id: 'knowledge', eyebrow: 'Knowledge, tooling & protocols', titleLines: ['Your knowledge.', 'Ready for action.'],
    body: 'Connect the knowledge your team trusts to the tools an agent can use. MCP, A2A, and Agent Skills describe how capabilities connect, without replacing your source of truth.',
    tags: ['MCP', 'A2A', 'Agent Skills'], logos: ['notion', 'confluence', 'guru', 'sharepoint'], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'The team grounds service answers in approved internal material and keeps access tied to the right sources.',
      startup: 'The founder connects product documentation to the assistant and its tools.',
      family: 'The shop brings service notes and operating procedures into one usable knowledge flow.',
      solo: 'The consultant makes reusable methods available to an assistant without losing the original documents.',
    },
  },
  {
    id: 'generative-ui', eyebrow: 'Generative UI', titleLines: ['Now put it', 'on the big screen.'],
    body: 'Cato pulls open a screen and renders a working Prefab interface for the example business. Tell him what needs to change and continue the conversation with the tool in view.',
    tags: ['Prefab', 'Live interface', 'Your business context'], logos: [], illustrativeLabel: journeyCopy.illustrative,
    stories: {
      enterprise: 'An illustrative service workspace brings the request, its owner, and the next action into view.',
      startup: 'An illustrative launch workspace gives the founder a place to work through product priorities.',
      family: 'An illustrative job-intake workspace keeps the customer request and next action together.',
      solo: 'An illustrative project workspace helps the consultant turn an inquiry into a clear next step.',
    },
  },
];

const workspaceLabels: Record<JourneyStory, [string, string]> = {
  enterprise: ['Service request', 'Request owner'],
  startup: ['Launch priority', 'Responsible person'],
  family: ['Customer request', 'Job owner'],
  solo: ['Project inquiry', 'Client or contact'],
};

/** Demonstration programs, not client records or claimed results. */
export const storyPrefabs: Record<JourneyStory, string> = Object.fromEntries(
  (Object.keys(journeyCopy.stories) as JourneyStory[]).map((story) => [story, `from prefab_ui.components import Column, Heading, Text, Input, Label
from prefab_ui.app import PrefabApp

with PrefabApp(state={"request": "", "owner": "", "next_action": ""}) as app:
    with Column(gap=4):
        Heading(${JSON.stringify(journeyCopy.stories[story] + ' workspace')})
        Text(${JSON.stringify(journeyCopy.illustrative)})
        Text(${JSON.stringify(journeyStops[8].stories[story])})
        Label(${JSON.stringify(workspaceLabels[story][0])})
        request = Input(name="request")
        Label(${JSON.stringify(workspaceLabels[story][1])})
        owner = Input(name="owner")
        Label("Next action")
        action = Input(placeholder="Describe the next action", name="next_action")
        Text(f"Request: {request.rx}")
        Text(f"Owner: {owner.rx}")
        Text(f"Next action: {action.rx}")
`]),
) as Record<JourneyStory, string>;
