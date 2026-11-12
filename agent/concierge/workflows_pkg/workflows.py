"""Durable Mistral Workflows for Cato Labs concierge lead qualification, booking, follow-up, hand-off, and daily digests."""

from __future__ import annotations

from datetime import timedelta

import mistralai.workflows as workflows
from mistralai.workflows.plugins.mistralai.connectors import uses_connectors

from .activities import (
    add_zoho_calendar_event_activity,
    check_notion_lead_active_activity,
    compile_and_send_daily_digest_activity,
    create_google_meet_event_activity,
    join_telnyx_meeting_bot_activity,
    log_lead_and_meeting_notion_activity,
    place_telnyx_handoff_call_activity,
    send_confirmation_bundle_activity,
    send_followup_step_activity,
    send_handoff_email_activity,
    validate_and_check_zoho_slot_activity,
)
from .constants import (
    gcal_connector,
    notion_connector,
    telnyx_connector,
    zoho_connector,
)
from .models import (
    DailyDigestInput,
    DailyDigestOutput,
    FollowUpSequenceInput,
    FollowUpSequenceOutput,
    HumanHandoffInput,
    HumanHandoffOutput,
    LeadQualification,
    QualifyBookConfirmInput,
    QualifyBookConfirmOutput,
)


@workflows.workflow.define(
    name="cato-follow-up-sequence",
    workflow_display_name="Cato Labs · Durable Multi-Step Email Follow-Up",
    workflow_description=(
        "Ensures the qualified lead is logged in Notion (💙 Generated Leads), durably sleeps between "
        "follow-up touchpoints, verifies Notion status before each step, and sends personalized HTML "
        "emails via Zoho Mail."
    ),
    execution_timeout=timedelta(days=365),
    on_behalf_of=True,
)
@uses_connectors(zoho_connector, notion_connector)
class FollowUpSequenceWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, params: FollowUpSequenceInput) -> FollowUpSequenceOutput:
        notion_lead_url = params.notion_lead_page_id.strip()
        if not notion_lead_url:
            logged = await log_lead_and_meeting_notion_activity(
                lead=LeadQualification(
                    visitor_name=params.visitor_name,
                    visitor_email=params.visitor_email,
                    visitor_phone=params.visitor_phone,
                    business=params.business,
                    goal=params.goal,
                    budget_range=params.budget_range,
                    source_site=params.source_site,
                    linkedin_url=params.linkedin_url,
                    notes=params.notes,
                ),
                callback_requested=False,
            )
            notion_lead_url = str(logged.get("notion_lead_url", ""))

        emails_sent = 0

        # Step 1 durable wait
        first_wait_sec = max(0.0, float(params.first_delay_hours) * 3600.0)
        if first_wait_sec > 0:
            await workflows.workflow.sleep(
                first_wait_sec,
                summary="Waiting before Follow-Up Step 1 email",
            )

        status_1 = await check_notion_lead_active_activity(page_id_or_url=notion_lead_url)
        if not status_1.get("should_send", True):
            return FollowUpSequenceOutput(
                notion_lead_url=notion_lead_url,
                emails_sent=emails_sent,
                stopped_early_reason=str(status_1.get("reason", "Stopped before Step 1")),
            )

        await send_followup_step_activity(
            payload=params,
            step_number=1,
            notion_lead_url=notion_lead_url,
        )
        emails_sent += 1

        # Step 2 durable wait
        second_wait_sec = max(0.0, float(params.second_delay_hours) * 3600.0)
        if second_wait_sec > 0:
            await workflows.workflow.sleep(
                second_wait_sec,
                summary="Waiting before Follow-Up Step 2 email",
            )

        status_2 = await check_notion_lead_active_activity(page_id_or_url=notion_lead_url)
        if not status_2.get("should_send", True):
            return FollowUpSequenceOutput(
                notion_lead_url=notion_lead_url,
                emails_sent=emails_sent,
                stopped_early_reason=str(status_2.get("reason", "Stopped before Step 2")),
            )

        await send_followup_step_activity(
            payload=params,
            step_number=2,
            notion_lead_url=notion_lead_url,
        )
        emails_sent += 1

        return FollowUpSequenceOutput(
            notion_lead_url=notion_lead_url,
            emails_sent=emails_sent,
        )


@workflows.workflow.define(
    name="cato-qualify-book-confirm",
    workflow_display_name="Cato Labs · Qualify, Book, Confirm & Telnyx Scribe",
    workflow_description=(
        "Validates all 6 mandatory qualification fields, checks Zoho Calendar free/busy (weekdays 9–5 PT, 45m), "
        "creates a Google Calendar event with Google Meet, records on Zoho Calendar, sends HTML confirmation via "
        "Zoho Mail, logs lead & meeting in Notion, and durably sleeps until start time to join the Telnyx Meeting Scribe."
    ),
    execution_timeout=timedelta(days=365),
    on_behalf_of=True,
)
@uses_connectors(zoho_connector, gcal_connector, notion_connector, telnyx_connector)
class QualifyBookConfirmWorkflow:
    def __init__(self) -> None:
        self._booking_snapshot: dict[str, object] = {"ready": False}

    @workflows.workflow.query(
        name="booking_status",
        description="Immediate booking confirmation snapshot before the durable sleep until Google Meet start time.",
    )
    def booking_status(self) -> dict[str, object]:
        return self._booking_snapshot

    @workflows.workflow.entrypoint
    async def run(self, params: QualifyBookConfirmInput) -> QualifyBookConfirmOutput:
        slot_check = await validate_and_check_zoho_slot_activity(payload=params)
        if not slot_check.get("ok"):
            rejected = QualifyBookConfirmOutput(
                booked=False,
                reason=str(slot_check.get("reason", "Requested slot is unavailable.")),
                suggested_open_slots=list(slot_check.get("suggested_open_slots", [])),
            )
            self._booking_snapshot = {"ready": True, **rejected.model_dump()}
            return rejected

        slot_start_iso = str(slot_check["slot_start_iso"])
        slot_end_iso = str(slot_check["slot_end_iso"])
        slot_human_pt = str(slot_check["slot_human_pt"])
        zoho_start = str(slot_check["zoho_start"])
        zoho_end = str(slot_check["zoho_end"])
        seconds_until_start = float(slot_check.get("seconds_until_start", 0.0))

        gcal_info = await create_google_meet_event_activity(
            payload=params,
            slot_start_iso=slot_start_iso,
            slot_end_iso=slot_end_iso,
        )
        google_meet_url = str(gcal_info.get("google_meet_url", ""))
        google_event_id = str(gcal_info.get("google_event_id", ""))

        zoho_created = await add_zoho_calendar_event_activity(
            payload=params,
            zoho_start=zoho_start,
            zoho_end=zoho_end,
            google_meet_url=google_meet_url,
        )

        email_sent = await send_confirmation_bundle_activity(
            payload=params,
            slot_human_pt=slot_human_pt,
            google_meet_url=google_meet_url,
        )

        notion_info = await log_lead_and_meeting_notion_activity(
            lead=LeadQualification(
                visitor_name=params.visitor_name,
                visitor_email=params.visitor_email,
                visitor_phone=params.visitor_phone,
                business=params.business,
                goal=params.goal,
                budget_range=params.budget_range,
                source_site=params.source_site,
                linkedin_url=params.linkedin_url,
                notes=params.notes,
            ),
            callback_requested=False,
            slot_start_iso=slot_start_iso,
            slot_end_iso=slot_end_iso,
            google_meet_url=google_meet_url,
        )
        notion_lead_url = str(notion_info.get("notion_lead_url", ""))
        notion_meeting_url = str(notion_info.get("notion_meeting_url", ""))

        if params.launch_follow_up_sequence:
            await workflows.execute_workflow(
                FollowUpSequenceWorkflow,
                FollowUpSequenceInput(
                    visitor_name=params.visitor_name,
                    visitor_email=params.visitor_email,
                    visitor_phone=params.visitor_phone,
                    business=params.business,
                    goal=params.goal,
                    budget_range=params.budget_range,
                    source_site=params.source_site,
                    linkedin_url=params.linkedin_url,
                    notes=params.notes,
                    notion_lead_page_id=notion_lead_url,
                    booked_meet_url=google_meet_url,
                    booked_slot_label=slot_human_pt,
                ),
                wait=False,
            )

        self._booking_snapshot = {
            "ready": True,
            "booked": True,
            "reason": "Discovery session booked and confirmed. Telnyx Concierge & Scribe is scheduled to join at start time.",
            "slot_start_pt": slot_start_iso,
            "slot_end_pt": slot_end_iso,
            "slot_human_pt": slot_human_pt,
            "google_meet_url": google_meet_url,
            "google_event_id": google_event_id,
            "zoho_event_created": bool(zoho_created),
            "confirmation_email_sent": bool(email_sent),
            "notion_lead_url": notion_lead_url,
            "notion_meeting_url": notion_meeting_url,
            "meeting_bot_scheduled": True,
        }

        # Durable sleep until discovery call start time, then launch 1 Telnyx Meeting Scribe & Assistant bot
        if seconds_until_start > 0:
            await workflows.workflow.sleep(
                seconds_until_start,
                summary=f"Waiting until {slot_human_pt} to join Google Meet with Telnyx Concierge & Scribe",
            )

        bot_info = await join_telnyx_meeting_bot_activity(
            payload=params,
            google_meet_url=google_meet_url,
            slot_start_iso=slot_start_iso,
        )

        return QualifyBookConfirmOutput(
            booked=True,
            reason="Discovery session booked, confirmed via Zoho Mail & Google Meet, logged in Notion, and Telnyx Scribe launched.",
            slot_start_pt=slot_start_iso,
            slot_end_pt=slot_end_iso,
            google_meet_url=google_meet_url,
            google_event_id=google_event_id,
            zoho_event_created=bool(zoho_created),
            confirmation_email_sent=bool(email_sent),
            notion_lead_url=notion_lead_url,
            notion_meeting_url=notion_meeting_url,
            meeting_bot_launched=bool(bot_info.get("launched", False)),
            meeting_session_id=str(bot_info.get("session_id", "")),
        )


@workflows.workflow.define(
    name="cato-human-handoff",
    workflow_display_name="Cato Labs · Immediate Human Hand-Off (Voice + Email + Notion)",
    workflow_description=(
        "Logs a high-priority callback request in Notion (💙 Generated Leads), places an immediate outbound "
        "Telnyx voice call from +17608769757 to +13852015802, and emails full hand-off context to tim@oubliai.com."
    ),
    execution_timeout=timedelta(hours=4),
    on_behalf_of=True,
)
@uses_connectors(telnyx_connector, zoho_connector, notion_connector)
class HumanHandoffWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, params: HumanHandoffInput) -> HumanHandoffOutput:
        extra_md = f"## Immediate Hand-Off Context\n- **Reason:** {params.urgency_reason}\n"
        if params.transcript_summary:
            extra_md += f"\n### Conversation Summary\n{params.transcript_summary}\n"

        notion_info = await log_lead_and_meeting_notion_activity(
            lead=LeadQualification(
                visitor_name=params.visitor_name,
                visitor_email=params.visitor_email,
                visitor_phone=params.visitor_phone,
                business=params.business,
                goal=params.goal,
                budget_range=params.budget_range,
                source_site=params.source_site,
                linkedin_url=params.linkedin_url,
                notes=params.notes,
            ),
            callback_requested=True,
            extra_markdown=extra_md,
        )
        notion_lead_url = str(notion_info.get("notion_lead_url", ""))

        call_info = await place_telnyx_handoff_call_activity(payload=params)
        call_ref = str(call_info.get("call_reference", ""))

        email_sent = await send_handoff_email_activity(
            payload=params,
            call_reference=call_ref,
            notion_lead_url=notion_lead_url,
        )

        return HumanHandoffOutput(
            voice_call_initiated=bool(call_info.get("initiated", False)),
            call_reference=call_ref,
            email_sent=bool(email_sent),
            notion_lead_url=notion_lead_url,
        )


@workflows.workflow.define(
    name="cato-daily-digest",
    workflow_display_name="Cato Labs · Executive Daily Digest",
    workflow_description=(
        "Queries Notion Generated Leads & Meetings plus upcoming Zoho Calendar events, synthesizes an "
        "executive daily briefing with Mistral zai-glm-5-3-flash, emails tim@oubliai.com via Zoho Mail, "
        "and archives the digest in Notion Docs."
    ),
    execution_timeout=timedelta(hours=2),
    on_behalf_of=False,
)
@uses_connectors(notion_connector, zoho_connector)
class DailyDigestWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, params: DailyDigestInput) -> DailyDigestOutput:
        return await compile_and_send_daily_digest_activity(params=params)


ALL_CATO_WORKFLOWS = [
    QualifyBookConfirmWorkflow,
    FollowUpSequenceWorkflow,
    HumanHandoffWorkflow,
    DailyDigestWorkflow,
]
