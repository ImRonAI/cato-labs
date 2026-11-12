"""Pydantic input/output contracts for Cato Labs durable Mistral Workflows."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LeadQualification(BaseModel):
    """All 6 mandatory qualification fields required before offering or booking discovery slots."""

    visitor_name: str = Field(description="Visitor's full name")
    visitor_email: str = Field(description="Visitor's email address")
    visitor_phone: str = Field(description="Visitor's phone number")
    business: str = Field(description="Company, brand, or organization name")
    goal: str = Field(description="Primary objective or project scope for Cato Labs")
    budget_range: str = Field(description="Estimated budget range for the engagement")
    source_site: str = Field(
        default="catolabs.com",
        description="Studio flagship slug or Cato Labs route where the conversation started",
    )
    linkedin_url: str = Field(default="", description="Optional LinkedIn profile URL")
    notes: str = Field(default="", description="Optional conversation context or architectural notes")


class QualifyBookConfirmInput(LeadQualification):
    """Input for cato-qualify-book-confirm durable workflow."""

    slot_start_iso: str = Field(
        description=(
            "Requested 45-minute discovery slot start time in ISO-8601 format with timezone "
            "(e.g. '2026-11-16T10:00:00-08:00'), weekday 9:00 AM – 5:00 PM America/Los_Angeles."
        )
    )
    launch_follow_up_sequence: bool = Field(
        default=True,
        description="Whether to also schedule post-booking preparation/follow-up touchpoints.",
    )


class QualifyBookConfirmOutput(BaseModel):
    booked: bool
    reason: str = ""
    slot_start_pt: str = ""
    slot_end_pt: str = ""
    google_meet_url: str = ""
    google_event_id: str = ""
    zoho_event_created: bool = False
    confirmation_email_sent: bool = False
    notion_lead_url: str = ""
    notion_meeting_url: str = ""
    suggested_open_slots: list[str] = Field(default_factory=list)
    meeting_bot_launched: bool = False
    meeting_session_id: str = ""


class FollowUpSequenceInput(LeadQualification):
    """Input for cato-follow-up-sequence durable multi-step email follow-up workflow."""

    notion_lead_page_id: str = Field(
        default="",
        description="Optional Notion lead page ID or URL to inspect and update across steps",
    )
    first_delay_hours: float = Field(
        default=48.0,
        description="Hours to wait before Step 1 follow-up email (default 48h / 2 days)",
    )
    second_delay_hours: float = Field(
        default=72.0,
        description="Hours after Step 1 before Step 2 follow-up email (default 72h / Day 5 total)",
    )
    booked_meet_url: str = Field(
        default="",
        description="Google Meet URL if a discovery session is already on calendar",
    )
    booked_slot_label: str = Field(
        default="",
        description="Formatted discovery slot in PT if already booked",
    )


class FollowUpSequenceOutput(BaseModel):
    notion_lead_url: str = ""
    emails_sent: int = 0
    stopped_early_reason: str = ""


class HumanHandoffInput(LeadQualification):
    """Input for cato-human-handoff workflow (immediate voice call to +13852015802 + Zoho email + Notion)."""

    urgency_reason: str = Field(
        default="Visitor requested live human hand-off with Cato Labs principal.",
        description="Why the visitor asked for immediate human hand-off",
    )
    transcript_summary: str = Field(
        default="",
        description="Concise summary of the concierge conversation so far",
    )


class HumanHandoffOutput(BaseModel):
    voice_call_initiated: bool
    call_reference: str = ""
    email_sent: bool
    notion_lead_url: str = ""


class DailyDigestInput(BaseModel):
    """Input for cato-daily-digest workflow (scheduled daily + runnable on demand)."""

    lookahead_days: int = Field(
        default=7,
        description="Number of upcoming days on Zoho Calendar to include in the digest",
    )
    recipient_email: str = Field(
        default="tim@oubliai.com",
        description="Recipient email address for the executive digest",
    )


class DailyDigestOutput(BaseModel):
    digest_date_pt: str
    subject: str
    email_sent: bool
    notion_doc_url: str = ""
    summary_markdown: str = ""
