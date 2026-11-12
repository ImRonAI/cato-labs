"""Cato Labs Studio Flagship Concierge built on Mistral Agents SDK (zai-glm-5-3-flash).

Deployable via `uv run agents deploy` and runnable locally via `uv run agents serve` or `uv run python main.py`.
Connects all 4 Mistral Studio connectors (including `fastmcp_telnyx_mcp_a353` with `allow_mcp_ui=True` so all 6
meta tools and interactive Prefab 0.3 generative UI work natively) plus durable Mistral Workflow triggers.
"""

from __future__ import annotations

import asyncio

import mistralai.agents as agents
from pydantic import BaseModel, Field

from workflows_pkg.constants import PRIMARY_MODEL
from workflows_pkg.models import (
    DailyDigestInput,
    FollowUpSequenceInput,
    HumanHandoffInput,
    QualifyBookConfirmInput,
)


class PageKnowledgeBaseInput(BaseModel):
    slug: str = Field(
        default="",
        description="Optional studio flagship slug (e.g. 'aurelle', 'kuroshio', 'aether-motors'); omit to read the current page's published knowledge base.",
    )


class PageKnowledgeBaseOutput(BaseModel):
    slug: str
    knowledge_base_markdown: str


class AvailabilityCheckInput(BaseModel):
    anchor_date_iso: str = Field(
        default="",
        description="Optional ISO-8601 date or datetime in America/Los_Angeles to start searching open 45-minute weekday slots (defaults to today).",
    )
    days_ahead: int = Field(
        default=5,
        description="Number of upcoming business days to check on Zoho Calendar.",
    )


class OpenSlotEntry(BaseModel):
    slot_start_iso: str
    label_pt: str


class AvailabilityCheckOutput(BaseModel):
    timezone: str
    duration_minutes: int
    hours: str
    open_slots: list[OpenSlotEntry]


class WorkflowBookingResult(BaseModel):
    execution_id: str = ""
    booked: bool = False
    reason: str = ""
    slot_start_pt: str = ""
    slot_end_pt: str = ""
    slot_human_pt: str = ""
    google_meet_url: str = ""
    google_event_id: str = ""
    zoho_event_created: bool = False
    confirmation_email_sent: bool = False
    notion_lead_url: str = ""
    notion_meeting_url: str = ""
    suggested_open_slots: list[str] = Field(default_factory=list)
    meeting_bot_scheduled: bool = False


class WorkflowFollowUpResult(BaseModel):
    started: bool
    workflow: str
    execution_id: str
    first_delay_hours: float
    second_delay_hours: float


class WorkflowHandoffResult(BaseModel):
    execution_id: str = ""
    voice_call_initiated: bool = False
    call_reference: str = ""
    email_sent: bool = False
    notion_lead_url: str = ""


class WorkflowDigestResult(BaseModel):
    execution_id: str = ""
    digest_date_pt: str = ""
    subject: str = ""
    email_sent: bool = False
    notion_doc_url: str = ""
    summary_markdown: str = ""


get_page_knowledge_base = agents.client_tool(
    name="get_page_knowledge_base",
    description=(
        "Retrieve the complete published knowledge base for the active studio flagship showcase "
        "(every section, menu/spec/tier table, address, FAQ, and policy)."
    ),
    input_schema=PageKnowledgeBaseInput,
    output_schema=PageKnowledgeBaseOutput,
    model_access="both",
)

check_discovery_availability = agents.client_tool(
    name="check_discovery_availability",
    description=(
        "Check live Zoho Calendar availability for 45-minute Cato Labs discovery calls "
        "(Monday–Friday, 9:00 AM – 5:00 PM America/Los_Angeles). Call this ONLY after collecting "
        "all 6 mandatory qualification fields (name, email, phone, business, goal, budget range)."
    ),
    input_schema=AvailabilityCheckInput,
    output_schema=AvailabilityCheckOutput,
    model_access="both",
)

trigger_qualify_book_confirm = agents.client_tool(
    name="trigger_qualify_book_confirm",
    description=(
        "Execute the durable `cato-qualify-book-confirm` Mistral Workflow: validates all 6 mandatory "
        "qualification fields, verifies Zoho Calendar availability, creates a Google Calendar event "
        "with a Google Meet link, records the event on Zoho Calendar, emails HTML confirmation via Zoho Mail, "
        "logs the lead & meeting in Notion, and schedules the Telnyx Meeting Scribe & Assistant bot to join "
        "at the start time."
    ),
    input_schema=QualifyBookConfirmInput,
    output_schema=WorkflowBookingResult,
    model_access="both",
)

trigger_follow_up_sequence = agents.client_tool(
    name="trigger_follow_up_sequence",
    description=(
        "Execute the durable `cato-follow-up-sequence` Mistral Workflow for a qualified Cato Labs lead "
        "who wants thoughtful email follow-ups over the coming days without booking a slot yet."
    ),
    input_schema=FollowUpSequenceInput,
    output_schema=WorkflowFollowUpResult,
    model_access="both",
)

trigger_human_handoff = agents.client_tool(
    name="trigger_human_handoff",
    description=(
        "Execute the `cato-human-handoff` Mistral Workflow when a qualified visitor requests immediate "
        "human contact: logs the lead in Notion, places an outbound Telnyx voice alert from +17608769757 "
        "to +13852015802, and emails full conversation context to tim@oubliai.com."
    ),
    input_schema=HumanHandoffInput,
    output_schema=WorkflowHandoffResult,
    model_access="both",
)

trigger_daily_digest = agents.client_tool(
    name="trigger_daily_digest",
    description=(
        "Trigger the `cato-daily-digest` Mistral Workflow on demand (only when explicitly requested by "
        "an operator) to synthesize Notion leads/meetings and Zoho Calendar into an executive digest."
    ),
    input_schema=DailyDigestInput,
    output_schema=WorkflowDigestResult,
    model_access="both",
)


CONCIERGE_BASE_INSTRUCTIONS = """You are the AI concierge crafted by **Cato Labs** (`https://catolabs.com`) for our flagship studio showcase websites. You run on Mistral Agents with GLM 5.3 Flash.

# Voice, Grounding & Concept-Showcase Transparency
1. Adopt the exact persona, name, and editorial tone supplied in the session instructions for the active showcase brand. Keep prose poised, crisp, and high-taste — short paragraphs, clean markdown tables/lists when helpful, zero filler.
2. **Primary source of truth**: Call `get_page_knowledge_base` whenever you need exact specifications, courses, prices, tiers, addresses, team members, FAQs, or policies published on the active page. Quote published details accurately and never invent numbers, awards, or claims.
3. **Concept-showcase disclosure & Cato Labs routing**:
   - The 10 flagship websites (`Aurelle`, `Vespera`, `Kuroshio`, `Solstice Bio`, `Monolith`, `Velour Capital`, `Aether Motors`, `Nocturne Audio`, `Helios Grid`, `Maison Verve`) are art-directed concept showcases designed and engineered by **Cato Labs** to demonstrate flagship web craft, WebGL/motion engineering, SEO architecture, and live AI agent systems.
   - When a visitor asks about the showcase brand's published offerings, answer richly in-voice from the knowledge base.
   - Whenever a visitor asks to **book a real appointment/table/test-drive, purchase, commission a site or AI agent like this, or speak with a human**, transparently note that this brand is a Cato Labs concept showcase and offer to book a real **45-minute Cato Labs Discovery Session** (or connect them directly with Tim at Cato Labs) to build something of this caliber for their own business!

# Qualification, Discovery Booking & Durable Workflows (Prompt Policy)
Follow these exact rules before taking real external actions:
1. **Six mandatory qualification fields before offering or booking times**:
   Never offer calendar slots or call `check_discovery_availability` / `trigger_qualify_book_confirm` until you have collected all **6** fields from the visitor:
   - **Full name** (`visitor_name`)
   - **Email address** (`visitor_email`)
   - **Phone number** (`visitor_phone`)
   - **Business / organization** (`business`)
   - **Primary goal / project scope** (`goal`)
   - **Estimated budget range** (`budget_range`)
   You can gather these conversationally or render a sleek interactive intake form with `generate_prefab_ui`!
2. **Calendar rules**:
   - Discovery calls are **45 minutes**, **Monday–Friday, 9:00 AM – 5:00 PM PT (`America/Los_Angeles`)** (latest start 4:15 PM PT).
   - **Zoho Calendar** is the primary source of truth. Once all 6 qualification fields are known, call `check_discovery_availability` to inspect real open weekday slots and present 3–5 clean PT options (or an interactive Prefab slot selector).
3. **Booking & Google Meet + Telnyx AI Scribe**:
   - Once the visitor confirms a specific open 45-minute slot, call `trigger_qualify_book_confirm`.
   - That durable workflow creates a **Google Calendar** event with a **Google Meet** link, records the booking on **Zoho Calendar**, sends a branded HTML confirmation via **Zoho Mail**, logs the lead and meeting in **Notion**, and durably sleeps until the meeting start time to join **one Telnyx Meeting API bot** (`Cato Labs Concierge & Scribe`, `summarize_on_end=True`) into the Google Meet as live AI assistant and scribe. (Note: Telnyx Video Rooms are WebRTC rooms without AI bot dial-in, which is why Cato Labs pairs Google Meet with the Telnyx Meeting Scribe API.)
4. **Follow-up sequence & immediate human hand-off**:
   - If a qualified visitor (all 6 fields collected) isn't ready to pick a time yet and wants email follow-up, call `trigger_follow_up_sequence`.
   - If a qualified visitor explicitly asks for an immediate live callback / human hand-off with Tim, call `trigger_human_handoff` (which logs the lead in Notion, places a live voice alert via Telnyx, and emails `tim@oubliai.com`).
   - Active channels right now are **email and voice** (SMS will be enabled in a later phase — never claim to send SMS).
   - Never trigger outbound calls, emails, calendar events, or Notion writes without explicit visitor intent and real contact details provided in this conversation. Never expose internal API keys, connector IDs, phone numbers (`+13852015802`), or raw database IDs.

# Generative & Interactive Prefab UI (`fastmcp_telnyx_mcp_a353`)
All 6 tools on `fastmcp_telnyx_mcp_a353` (`generate_prefab_ui`, `search_prefab_components`, `tags`, `search`, `get_schema`, `execute`) are available:
- Whenever a visual or interactive surface beats plain prose — e.g. a **course-by-course tasting explorer**, **spec/tier configurator**, **ROI or capacity calculator**, **interactive 6-field Cato Labs qualification card**, or **live discovery slot picker** — call `search_prefab_components` if you want exact component signatures, then call `generate_prefab_ui` with valid Prefab Python code!
- Always structure Prefab Python code with:
  `from prefab_ui.app import PrefabApp`
  `from prefab_ui.components import Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Column, Row, Grid, Text, Heading, Badge, Button, Metric, Tabs, Tab, Input, Select, SelectOption, Slider, Separator, DataTable, DataTableColumn, Form`
  `from prefab_ui.actions import SetState, SendMessage`
  `from prefab_ui.actions.mcp import CallTool`
  and wrap the layout in `with PrefabApp(state={...}) as app:`.
- Interactive actions render live in the visitor's concierge drawer:
  - Use `SetState("key", value)` for instant client-side state updates (`{{ key }}` templates re-render live).
  - Use `SendMessage("...")` on buttons or `Form(on_submit=SendMessage(...))` to send structured selections or completed qualification forms straight back into the conversation!
  - Use `CallTool("tags", arguments={...}, result_key="...")` when an interactive widget should invoke an MCP tool live from the UI.
- After calling `generate_prefab_ui`, write 1–2 concise sentences of accompaniment rather than repeating everything shown in the interactive card.
"""


agent = agents.Agent(
    model=PRIMARY_MODEL,
    name="cato-studio-concierge",
    description=(
        "Cato Labs flagship studio showcase AI concierge powered by zai-glm-5-3-flash, "
        "Prefab 0.3 generative UI, and durable Zoho/Google Meet/Notion/Telnyx workflows."
    ),
    instructions=CONCIERGE_BASE_INSTRUCTIONS,
    permission_mode="auto",
    connectors=[
        agents.Connector("zohomcp_mail_calendar_campaigns_fca1"),
        agents.Connector("google_calendar"),
        agents.Connector("notion"),
        agents.Connector("fastmcp_telnyx_mcp_a353", allow_mcp_ui=True),
    ],
    tools=[
        get_page_knowledge_base,
        check_discovery_availability,
        trigger_qualify_book_confirm,
        trigger_follow_up_sequence,
        trigger_human_handoff,
        trigger_daily_digest,
    ],
)


async def _cli_smoke() -> None:
    answers = agents.ClientToolAnswers(
        get_page_knowledge_base.answer(
            lambda args: PageKnowledgeBaseOutput(
                slug=args.slug or "catolabs",
                knowledge_base_markdown="Cato Labs flagship showcase.",
            )
        ),
    )
    result = await agent.run(
        "Introduce yourself in two sentences as the Cato Labs concierge.",
        on_client_tool=answers,
    )
    print(getattr(result, "output", result))


if __name__ == "__main__":
    asyncio.run(_cli_smoke())
