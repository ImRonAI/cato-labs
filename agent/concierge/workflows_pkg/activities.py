"""Activities for Cato Labs Mistral Workflows across Zoho, Google Calendar, Notion, and Telnyx."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import mistralai.workflows as workflows
from mistralai.workflows import Depends
from mistralai.workflows.plugins.mistralai import get_mistral_client
from mistralai.workflows.plugins.mistralai.connectors import ToolCallClient

from .constants import (
    CATO_BRAND,
    CATO_SITE_URL,
    DISCOVERY_DURATION_MINUTES,
    DISCOVERY_END_HOUR,
    DISCOVERY_START_HOUR,
    DISCOVERY_TIMEZONE,
    HANDOFF_TO_NUMBER,
    NOTION_DOCS_DS_ID,
    NOTION_LEADS_COLLECTION,
    NOTION_LEADS_DS_ID,
    NOTION_MEETINGS_COLLECTION,
    NOTION_MEETINGS_DS_ID,
    OWNER_EMAIL,
    PRIMARY_MODEL,
    TELNYX_CATO_ASSISTANT_ID,
    TELNYX_CATO_TEXML_APP_ID,
    TELNYX_FROM_NUMBER,
    ZOHO_CALUID,
    gcal_connector,
    notion_connector,
    telnyx_connector,
    zoho_connector,
)
from .models import (
    DailyDigestInput,
    DailyDigestOutput,
    FollowUpSequenceInput,
    HumanHandoffInput,
    LeadQualification,
    QualifyBookConfirmInput,
)

PT_TZ = ZoneInfo(DISCOVERY_TIMEZONE)
_MEET_RE = re.compile(r"https://meet\.google\.com/[a-zA-Z0-9-]+")
_NOTION_URL_RE = re.compile(r"https://www\.notion\.so/[a-zA-Z0-9-]+")


def _extract_text(raw: Any) -> str:
    """Pull readable text from a ToolCallClient response."""
    if raw is None:
        return ""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        content = raw.get("content")
        if isinstance(content, list):
            parts = []
            for block in content:
                if isinstance(block, dict) and isinstance(block.get("text"), str):
                    parts.append(block["text"])
                elif hasattr(block, "text") and isinstance(block.text, str):
                    parts.append(block.text)
            if parts:
                return "\n".join(parts)
        return json.dumps(raw, default=str)
    content_attr = getattr(raw, "content", None)
    if isinstance(content_attr, list):
        parts = [getattr(b, "text", "") for b in content_attr if getattr(b, "text", None)]
        if parts:
            return "\n".join(parts)
    if hasattr(raw, "model_dump"):
        return _extract_text(raw.model_dump())
    return str(raw)


def _extract_json(raw: Any) -> Any:
    """Parse JSON from a ToolCallClient response when available."""
    if isinstance(raw, dict):
        for key in ("structured_content", "structuredContent", "data"):
            if raw.get(key) is not None:
                return raw[key]
    txt = _extract_text(raw).strip()
    if not txt:
        return raw
    try:
        return json.loads(txt)
    except Exception:
        return txt


def _parse_pt_datetime(iso_str: str) -> datetime:
    cleaned = iso_str.strip()
    if cleaned.endswith("Z"):
        cleaned = cleaned[:-1] + "+00:00"
    dt = datetime.fromisoformat(cleaned)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=PT_TZ)
    return dt.astimezone(PT_TZ)


def _format_zoho_local(dt_pt: datetime) -> str:
    return dt_pt.strftime("%Y%m%dT%H%M%S")


def _parse_zoho_interval(entry: dict[str, Any]) -> tuple[datetime, datetime] | None:
    """Parse busy slot or event start/end timestamps from Zoho Calendar payloads."""
    try:
        if "startTime" in entry and "endTime" in entry:
            s_raw = str(entry["startTime"])
            e_raw = str(entry["endTime"])
        elif isinstance(entry.get("dateandtime"), dict):
            dt_obj = entry["dateandtime"]
            s_raw = str(dt_obj.get("start", ""))
            e_raw = str(dt_obj.get("end", ""))
        else:
            return None

        def _to_pt(val: str) -> datetime:
            v = val.strip()
            if v.isdigit():
                ms = int(v)
                if ms > 10_000_000_000:
                    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).astimezone(PT_TZ)
                return datetime.fromtimestamp(ms, tz=timezone.utc).astimezone(PT_TZ)
            if v.endswith("Z") and "T" in v and "-" not in v:
                return datetime.strptime(v, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).astimezone(PT_TZ)
            for fmt in ("%Y%m%dT%H%M%S%z", "%Y%m%dT%H%M%S"):
                try:
                    parsed = datetime.strptime(v, fmt)
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=PT_TZ)
                    return parsed.astimezone(PT_TZ)
                except ValueError:
                    continue
            return _parse_pt_datetime(v)

        return (_to_pt(s_raw), _to_pt(e_raw))
    except Exception:
        return None


def _collect_busy_windows(payload: Any) -> list[tuple[datetime, datetime]]:
    windows: list[tuple[datetime, datetime]] = []

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            interval = _parse_zoho_interval(node)
            if interval is not None:
                windows.append(interval)
            for v in node.values():
                _walk(v)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    _walk(payload)
    return windows


def _overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and b_start < a_end


def _compute_open_slots(
    anchor_pt: datetime,
    busy_windows: list[tuple[datetime, datetime]],
    days_ahead: int = 5,
) -> list[str]:
    """Generate open 45-minute weekday slots between 9:00 AM and 5:00 PM PT."""
    now_pt = datetime.now(tz=PT_TZ)
    base_day = max(anchor_pt.date(), now_pt.date())
    candidates: list[str] = []
    duration = timedelta(minutes=DISCOVERY_DURATION_MINUTES)

    for day_offset in range(days_ahead + 4):
        day = base_day + timedelta(days=day_offset)
        if day.weekday() >= 5:
            continue
        cursor = datetime(day.year, day.month, day.day, DISCOVERY_START_HOUR, 0, tzinfo=PT_TZ)
        day_end = datetime(day.year, day.month, day.day, DISCOVERY_END_HOUR, 0, tzinfo=PT_TZ)
        while cursor + duration <= day_end:
            if cursor > now_pt + timedelta(minutes=20):
                slot_end = cursor + duration
                if not any(_overlaps(cursor, slot_end, bs, be) for bs, be in busy_windows):
                    candidates.append(cursor.isoformat())
            cursor += timedelta(minutes=45)
    return candidates


def _validate_six_fields(lead: LeadQualification) -> list[str]:
    missing: list[str] = []
    if not lead.visitor_name.strip():
        missing.append("name")
    if not lead.visitor_email.strip() or "@" not in lead.visitor_email:
        missing.append("email")
    if not lead.visitor_phone.strip():
        missing.append("phone number")
    if not lead.business.strip():
        missing.append("business")
    if not lead.goal.strip():
        missing.append("goal")
    if not lead.budget_range.strip():
        missing.append("budget range")
    return missing


@workflows.activity(name="validate-and-check-zoho-slot")
async def validate_and_check_zoho_slot_activity(
    payload: QualifyBookConfirmInput,
    zoho: ToolCallClient = Depends(zoho_connector),
) -> dict[str, Any]:
    """Validate all 6 qualification fields and verify the 45-min weekday 9–5 PT slot in Zoho Calendar."""
    missing = _validate_six_fields(payload)
    if missing:
        return {
            "ok": False,
            "reason": f"Missing mandatory qualification fields before booking: {', '.join(missing)}.",
            "suggested_open_slots": [],
        }

    try:
        start_pt = _parse_pt_datetime(payload.slot_start_iso)
    except Exception as exc:
        return {
            "ok": False,
            "reason": f"Invalid ISO-8601 slot_start_iso ({payload.slot_start_iso}): {exc}",
            "suggested_open_slots": [],
        }

    end_pt = start_pt + timedelta(minutes=DISCOVERY_DURATION_MINUTES)

    # Enforce weekday 9:00 AM – 5:00 PM America/Los_Angeles
    day_open = start_pt.replace(hour=DISCOVERY_START_HOUR, minute=0, second=0, microsecond=0)
    day_close = start_pt.replace(hour=DISCOVERY_END_HOUR, minute=0, second=0, microsecond=0)

    range_start = min(start_pt, datetime.now(tz=PT_TZ)).replace(hour=0, minute=0, second=0, microsecond=0)
    range_end = (range_start + timedelta(days=7)).replace(hour=23, minute=59, second=59, microsecond=0)

    busy_windows: list[tuple[datetime, datetime]] = []
    try:
        fb_raw = await zoho.call_tool(
            tool_name="ZohoCalendar_get_busy_slots",
            arguments={
                "query_params": {
                    "attendees": OWNER_EMAIL,
                    "sdate": _format_zoho_local(range_start),
                    "edate": _format_zoho_local(range_end),
                    "mode": "busyslots",
                    "duration": str(DISCOVERY_DURATION_MINUTES),
                }
            },
        )
        busy_windows.extend(_collect_busy_windows(_extract_json(fb_raw)))
    except Exception:
        pass

    try:
        ev_raw = await zoho.call_tool(
            tool_name="ZohoCalendar_get_event",
            arguments={
                "query_params": {
                    "caluid": ZOHO_CALUID,
                    "start": range_start.strftime("%Y%m%d"),
                    "end": range_end.strftime("%Y%m%d"),
                    "byinstance": "true",
                }
            },
        )
        busy_windows.extend(_collect_busy_windows(_extract_json(ev_raw)))
    except Exception:
        pass

    if start_pt.weekday() >= 5 or start_pt < day_open or end_pt > day_close:
        suggestions = _compute_open_slots(start_pt, busy_windows)
        return {
            "ok": False,
            "reason": (
                "Discovery calls are 45 minutes on weekdays (Monday–Friday) between 9:00 AM and 5:00 PM PT "
                "(latest start 4:15 PM PT)."
            ),
            "suggested_open_slots": suggestions,
        }

    has_conflict = any(_overlaps(start_pt, end_pt, bs, be) for bs, be in busy_windows)
    if has_conflict:
        suggestions = _compute_open_slots(start_pt, busy_windows)
        return {
            "ok": False,
            "reason": "That 45-minute window is already busy on Zoho Calendar.",
            "suggested_open_slots": suggestions,
        }

    now_utc = datetime.now(tz=timezone.utc)
    seconds_until_start = max(0.0, (start_pt.astimezone(timezone.utc) - now_utc).total_seconds())
    return {
        "ok": True,
        "slot_start_iso": start_pt.isoformat(),
        "slot_end_iso": end_pt.isoformat(),
        "slot_human_pt": f"{start_pt.strftime('%A, %B %-d, %Y · %-I:%M %p')} – {end_pt.strftime('%-I:%M %p PT')}",
        "zoho_start": _format_zoho_local(start_pt),
        "zoho_end": _format_zoho_local(end_pt),
        "seconds_until_start": seconds_until_start,
    }


@workflows.activity(name="create-google-meet-event")
async def create_google_meet_event_activity(
    payload: QualifyBookConfirmInput,
    slot_start_iso: str,
    slot_end_iso: str,
    gcal: ToolCallClient = Depends(gcal_connector),
) -> dict[str, str]:
    """Create the Google Calendar event with addGoogleMeetUrl=True and return the Google Meet URL."""
    description = (
        f"Cato Labs Discovery Session ({DISCOVERY_DURATION_MINUTES} min)\n\n"
        f"Client: {payload.visitor_name} ({payload.business})\n"
        f"Email: {payload.visitor_email}\n"
        f"Phone: {payload.visitor_phone}\n"
        f"Goal: {payload.goal}\n"
        f"Budget Range: {payload.budget_range}\n"
        f"Source Showcase: {payload.source_site}\n"
        + (f"\nNotes:\n{payload.notes}\n" if payload.notes else "")
    )
    res = await gcal.call_tool(
        tool_name="create_event",
        arguments={
            "summary": f"Cato Labs Discovery — {payload.visitor_name} ({payload.business})",
            "startTime": slot_start_iso,
            "endTime": slot_end_iso,
            "timeZone": DISCOVERY_TIMEZONE,
            "addGoogleMeetUrl": True,
            "attendees": [
                {"email": payload.visitor_email, "displayName": payload.visitor_name},
                {"email": OWNER_EMAIL, "displayName": "Tim · Cato Labs"},
            ],
            "notificationLevel": "NONE",
            "description": description,
        },
    )
    raw_txt = _extract_text(res)
    parsed = _extract_json(res)
    meet_url = ""
    event_id = ""
    if isinstance(parsed, dict):
        event_id = str(parsed.get("id") or parsed.get("eventId") or "")
        meet_url = str(
            parsed.get("hangoutLink")
            or parsed.get("googleMeetUrl")
            or parsed.get("meetUrl")
            or ""
        )
        if not meet_url and isinstance(parsed.get("conferenceData"), dict):
            for ep in parsed["conferenceData"].get("entryPoints", []) or []:
                if isinstance(ep, dict) and str(ep.get("uri", "")).startswith("https://meet.google.com/"):
                    meet_url = str(ep["uri"])
                    break
    if not meet_url:
        m = _MEET_RE.search(raw_txt)
        if m:
            meet_url = m.group(0)
    return {
        "google_meet_url": meet_url,
        "google_event_id": event_id,
    }


@workflows.activity(name="add-zoho-calendar-event")
async def add_zoho_calendar_event_activity(
    payload: QualifyBookConfirmInput,
    zoho_start: str,
    zoho_end: str,
    google_meet_url: str,
    zoho: ToolCallClient = Depends(zoho_connector),
) -> bool:
    """Record the discovery call on Zoho Calendar (primary source of truth)."""
    description = (
        f"Google Meet: {google_meet_url}\n"
        f"Visitor: {payload.visitor_name} ({payload.business})\n"
        f"Email: {payload.visitor_email} | Phone: {payload.visitor_phone}\n"
        f"Goal: {payload.goal}\n"
        f"Budget Range: {payload.budget_range}\n"
        f"Origin: {payload.source_site}"
    )
    await zoho.call_tool(
        tool_name="ZohoCalendar_add_event",
        arguments={
            "body": {
                "caluid": ZOHO_CALUID,
                "title": f"Cato Labs Discovery — {payload.visitor_name} ({payload.business})",
                "dateandtime": {
                    "start": zoho_start,
                    "end": zoho_end,
                    "timezone": DISCOVERY_TIMEZONE,
                },
                "attendees": [
                    {
                        "email": payload.visitor_email,
                        "attendance": "1",
                        "permission": "1",
                    }
                ],
                "location": google_meet_url or "Google Meet",
                "url": google_meet_url or CATO_SITE_URL,
                "description": description,
                "notify_attendee": "1",
            }
        },
    )
    return True


@workflows.activity(name="send-zoho-email")
async def send_zoho_email_activity(
    to_address: str,
    subject: str,
    html_content: str,
    cc_address: str = "",
    zoho: ToolCallClient = Depends(zoho_connector),
) -> bool:
    """Send a branded HTML email via Zoho Mail from tim@oubliai.com."""
    body: dict[str, Any] = {
        "fromAddress": OWNER_EMAIL,
        "toAddress": to_address,
        "subject": subject,
        "content": html_content,
        "contentType": "html",
    }
    if cc_address:
        body["ccAddress"] = cc_address
    await zoho.call_tool(
        tool_name="ZohoMail_send_mail",
        arguments={
            "path_variables": {"accountId": "me"},
            "body": body,
        },
    )
    return True


def _build_confirmation_email_html(
    payload: QualifyBookConfirmInput,
    slot_human_pt: str,
    google_meet_url: str,
) -> str:
    esc = html.escape
    meet_cta = (
        f'<p style="margin:24px 0;"><a href="{esc(google_meet_url)}" '
        f'style="display:inline-block;padding:12px 22px;background:#2e4bff;color:#ffffff;'
        f'text-decoration:none;border-radius:4px;font-weight:600;letter-spacing:0.01em;">'
        f"Join Google Meet</a></p>"
        if google_meet_url
        else ""
    )
    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px 20px;background:#fafbfe;color:#0a0c12;font-family:-apple-system,BlinkMacSystemFont,'Inter',Segoe UI,sans-serif;line-height:1.6;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e4e8f2;padding:36px;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#2e4bff;font-weight:600;">CATO LABS · DISCOVERY CONFIRMED</p>
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;letter-spacing:-0.02em;color:#0a0c12;">Your strategy &amp; architecture session is booked.</h1>
    <p style="margin:0 0 20px;color:#363b49;">Hello {esc(payload.visitor_name)},</p>
    <p style="margin:0 0 20px;color:#363b49;">We have confirmed your 45-minute discovery session with <strong>{CATO_BRAND}</strong>. Both Tim and our Cato AI Concierge &amp; Scribe will join the Google Meet at the scheduled start time so every technical and strategic detail is captured cleanly.</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;width:140px;">When</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;font-weight:600;">{esc(slot_human_pt)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Organization</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;">{esc(payload.business)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Focus</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;">{esc(payload.goal)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Budget Range</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;">{esc(payload.budget_range)}</td></tr>
      <tr><td style="padding:8px 0;color:#656d80;">Google Meet</td><td style="padding:8px 0;"><a href="{esc(google_meet_url)}" style="color:#2e4bff;">{esc(google_meet_url or 'Included in calendar invite')}</a></td></tr>
    </table>
    {meet_cta}
    <p style="margin:24px 0 0;font-size:13px;color:#656d80;">Need to adjust the time or share materials beforehand? Simply reply directly to this email.</p>
    <hr style="border:none;border-top:1px solid #edf0f7;margin:28px 0 16px;" />
    <p style="margin:0;font-size:12px;color:#8a92a6;">Cato Labs · Strategy, Design, Engineering &amp; AI Agent Systems · <a href="{CATO_SITE_URL}" style="color:#2e4bff;text-decoration:none;">catolabs.com</a></p>
  </div>
</body>
</html>"""


@workflows.activity(name="log-lead-and-meeting-notion")
async def log_lead_and_meeting_notion_activity(
    lead: LeadQualification,
    callback_requested: bool = False,
    slot_start_iso: str = "",
    slot_end_iso: str = "",
    google_meet_url: str = "",
    extra_markdown: str = "",
    notion: ToolCallClient = Depends(notion_connector),
) -> dict[str, str]:
    """Create a page in 💙 Generated Leads and optionally in Meetings."""
    now_iso = datetime.now(tz=PT_TZ).isoformat()
    lead_md = (
        f"## Qualification Brief\n"
        f"- **Business:** {lead.business}\n"
        f"- **Goal:** {lead.goal}\n"
        f"- **Budget Range:** {lead.budget_range}\n"
        f"- **Source Showcase:** `{lead.source_site}`\n"
        f"- **Email:** {lead.visitor_email}\n"
        f"- **Phone:** {lead.visitor_phone}\n"
    )
    if slot_start_iso:
        lead_md += f"- **Booked Discovery Slot:** `{slot_start_iso}` → `{slot_end_iso}`\n"
    if google_meet_url:
        lead_md += f"- **Google Meet:** {google_meet_url}\n"
    if lead.notes:
        lead_md += f"\n## Concierge Notes\n{lead.notes}\n"
    if extra_markdown:
        lead_md += f"\n{extra_markdown}\n"

    lead_props: dict[str, Any] = {
        "Name": f"{lead.visitor_name} — {lead.business}",
        "Business": lead.business,
        "Email": lead.visitor_email,
        "Phone": lead.visitor_phone,
        "date:Date of Interaction:start": now_iso,
        "date:Date of Interaction:is_datetime": 1,
        "Callback Requested": "__YES__" if callback_requested else "__NO__",
        "Ready for Callback": "__YES__" if callback_requested else "__NO__",
        "Research Requested": "__NO__",
    }
    if lead.linkedin_url.strip():
        lead_props["LinkedIn"] = lead.linkedin_url.strip()

    lead_res = await notion.call_tool(
        tool_name="notion-create-pages",
        arguments={
            "parent": {"type": "data_source_id", "data_source_id": NOTION_LEADS_DS_ID},
            "pages": [{"properties": lead_props, "content": lead_md}],
        },
    )
    lead_txt = _extract_text(lead_res)
    lead_url_match = _NOTION_URL_RE.search(lead_txt)
    lead_url = lead_url_match.group(0) if lead_url_match else ""

    meeting_url = ""
    if slot_start_iso and slot_end_iso:
        meeting_md = (
            f"## Cato Labs Discovery Session\n"
            f"- **Attendee:** {lead.visitor_name} ({lead.business})\n"
            f"- **Contact:** {lead.visitor_email} · {lead.visitor_phone}\n"
            f"- **Google Meet:** {google_meet_url}\n"
            f"- **Goal:** {lead.goal}\n"
            f"- **Budget Range:** {lead.budget_range}\n"
            f"- **AI Scribe:** Telnyx Meeting Bot (`{TELNYX_CATO_ASSISTANT_ID}`) scheduled to join at start time.\n"
        )
        if lead_url:
            meeting_md += f"- **Lead Record:** {lead_url}\n"
        m_res = await notion.call_tool(
            tool_name="notion-create-pages",
            arguments={
                "parent": {"type": "data_source_id", "data_source_id": NOTION_MEETINGS_DS_ID},
                "pages": [
                    {
                        "properties": {
                            "Name": f"Discovery: {lead.visitor_name} ({lead.business})",
                            "date:Date:start": slot_start_iso,
                            "date:Date:end": slot_end_iso,
                            "date:Date:is_datetime": 1,
                        },
                        "content": meeting_md,
                    }
                ],
            },
        )
        m_txt = _extract_text(m_res)
        m_match = _NOTION_URL_RE.search(m_txt)
        meeting_url = m_match.group(0) if m_match else ""

    return {
        "notion_lead_url": lead_url,
        "notion_meeting_url": meeting_url,
    }


@workflows.activity(name="join-telnyx-meeting-bot")
async def join_telnyx_meeting_bot_activity(
    payload: QualifyBookConfirmInput,
    google_meet_url: str,
    slot_start_iso: str,
    telnyx: ToolCallClient = Depends(telnyx_connector),
) -> dict[str, Any]:
    """Launch the single Telnyx Meeting API bot into the Google Meet as AI assistant + scribe."""
    if not google_meet_url:
        return {"launched": False, "session_id": "", "detail": "No Google Meet URL provided"}

    idempotency_key = f"cato-meet-{payload.visitor_email}-{slot_start_iso}"
    session_args = {
        "meeting_url": google_meet_url,
        "bot_name": "Cato Labs Concierge & Scribe",
        "summarize_on_end": True,
        "barge_in": True,
        "speak_on_enter": (
            f"Hello {payload.visitor_name} and Tim — Cato here from Cato Labs, joining as your discovery assistant and live scribe."
        ),
        "chat_on_enter": (
            "Cato Labs AI Concierge & Scribe is active. Key architecture notes and action items will be summarized when the session ends."
        ),
        "idempotency_key": idempotency_key,
        "metadata": {
            "visitor_name": payload.visitor_name,
            "business": payload.business,
            "source_site": payload.source_site,
        },
        "assistant": {
            "id": TELNYX_CATO_ASSISTANT_ID,
            "leave_on_end": True,
            "dynamic_variables": {
                "call_mode": "meeting_scribe",
                "initial_greeting": (
                    f"Hello {payload.visitor_name} and Tim — Cato here as your Cato Labs discovery assistant and scribe."
                ),
                "visitor_name": payload.visitor_name,
                "business": payload.business,
                "visitor_email": payload.visitor_email,
                "visitor_phone": payload.visitor_phone,
                "goal": payload.goal,
                "budget_range": payload.budget_range,
                "source_site": payload.source_site,
                "handoff_notes": payload.notes,
            },
        },
    }
    code = f"return await call_tool('createMeetingSession', {json.dumps(session_args)})"
    res = await telnyx.call_tool(tool_name="execute", arguments={"code": code})
    parsed = _extract_json(res)
    session_id = ""
    if isinstance(parsed, dict):
        data = parsed.get("data", parsed)
        if isinstance(data, dict):
            session_id = str(data.get("id", ""))
    return {
        "launched": True,
        "session_id": session_id,
    }


@workflows.activity(name="send-confirmation-bundle")
async def send_confirmation_bundle_activity(
    payload: QualifyBookConfirmInput,
    slot_human_pt: str,
    google_meet_url: str,
    zoho: ToolCallClient = Depends(zoho_connector),
) -> bool:
    """Send branded HTML confirmation email + Google Meet link to the visitor (cc tim@oubliai.com)."""
    html_body = _build_confirmation_email_html(payload, slot_human_pt, google_meet_url)
    return await send_zoho_email_activity(
        to_address=payload.visitor_email,
        cc_address=OWNER_EMAIL,
        subject=f"Confirmed: Cato Labs Discovery Session · {slot_human_pt}",
        html_content=html_body,
        zoho=zoho,
    )


@workflows.activity(name="check-notion-lead-active")
async def check_notion_lead_active_activity(
    page_id_or_url: str,
    notion: ToolCallClient = Depends(notion_connector),
) -> dict[str, Any]:
    """Inspect Notion lead page before sending a follow-up step to ensure follow-up is still appropriate."""
    if not page_id_or_url.strip():
        return {"should_send": True, "reason": "No page ID supplied; proceeding."}
    res = await notion.call_tool(
        tool_name="notion-fetch",
        arguments={"id": page_id_or_url.strip()},
    )
    txt = _extract_text(res)
    lowered = txt.lower()
    for stop_phrase in ("[stop-followup]", "status: closed", "do not follow up", "unsubscribed"):
        if stop_phrase in lowered:
            return {"should_send": False, "reason": f"Lead page marked '{stop_phrase}'."}
    return {"should_send": True, "page_excerpt": txt}


@workflows.activity(name="send-followup-step")
async def send_followup_step_activity(
    payload: FollowUpSequenceInput,
    step_number: int,
    notion_lead_url: str,
    zoho: ToolCallClient = Depends(zoho_connector),
    notion: ToolCallClient = Depends(notion_connector),
) -> bool:
    """Send tailored follow-up email via Zoho Mail and log progress on the Notion lead page."""
    esc = html.escape
    if step_number == 1:
        subject = f"Cato Labs × {payload.business} — Architectural notes ahead of our conversation"
        body_copy = (
            f"<p>Hello {esc(payload.visitor_name)},</p>"
            f"<p>Following up on your conversation with our concierge on <strong>{esc(payload.source_site)}</strong> "
            f"regarding <em>{esc(payload.goal)}</em>.</p>"
            + (
                f"<p>Your discovery session is confirmed for <strong>{esc(payload.booked_slot_label)}</strong> "
                f"(<a href='{esc(payload.booked_meet_url)}' style='color:#2e4bff;'>Google Meet</a>). "
                f"If there are existing repositories, brand decks, or workflow diagrams you would like us to review beforehand, "
                f"feel free to reply here.</p>"
                if payload.booked_meet_url
                else "<p>If you would like to lock in a 45-minute weekday discovery session (9:00 AM – 5:00 PM PT), "
                "simply reply with a day that suits your schedule and we will send a Google Meet invitation directly.</p>"
            )
        )
    else:
        subject = f"Checking in — {payload.business} & Cato Labs"
        body_copy = (
            f"<p>Hello {esc(payload.visitor_name)},</p>"
            f"<p>Wanted to send one brief note in case timing has shifted on <em>{esc(payload.goal)}</em>. "
            f"We keep our practice intentionally senior and integrated across strategy, product engineering, and durable AI agents, "
            f"so whenever you are ready to explore next steps, reply directly to this thread and Tim will pick right up.</p>"
        )

    html_doc = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:28px 18px;background:#fafbfe;color:#0a0c12;font-family:-apple-system,BlinkMacSystemFont,'Inter',Segoe UI,sans-serif;line-height:1.6;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e8f2;padding:32px;">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#2e4bff;font-weight:600;">CATO LABS</p>
    {body_copy}
    <p style="margin:24px 0 0;color:#363b49;">Warm regards,<br/><strong>Tim &amp; Cato Labs</strong><br/><a href="{CATO_SITE_URL}" style="color:#2e4bff;text-decoration:none;">catolabs.com</a></p>
  </div>
</body>
</html>"""

    await zoho.call_tool(
        tool_name="ZohoMail_send_mail",
        arguments={
            "path_variables": {"accountId": "me"},
            "body": {
                "fromAddress": OWNER_EMAIL,
                "toAddress": payload.visitor_email,
                "subject": subject,
                "content": html_doc,
                "contentType": "html",
            },
        },
    )

    if notion_lead_url.strip():
        stamp = datetime.now(tz=PT_TZ).strftime("%Y-%m-%d %H:%M PT")
        try:
            await notion.call_tool(
                tool_name="notion-create-comment",
                arguments={
                    "page_id": notion_lead_url.strip(),
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": f"Follow-up email #{step_number} sent via Zoho Mail at {stamp}."},
                        }
                    ],
                },
            )
        except Exception:
            pass
    return True


@workflows.activity(name="place-telnyx-handoff-call")
async def place_telnyx_handoff_call_activity(
    payload: HumanHandoffInput,
    telnyx: ToolCallClient = Depends(telnyx_connector),
) -> dict[str, Any]:
    """Place an immediate outbound Telnyx voice call from +17608769757 to +13852015802."""
    briefing_greeting = (
        f"Hi Tim — Cato here with a live Cato Labs human hand-off from {payload.source_site}. "
        f"{payload.visitor_name} from {payload.business} asked to speak with you. "
        f"Their phone number is {payload.visitor_phone}, budget range {payload.budget_range}, "
        f"and their goal is: {payload.goal}."
    )
    ai_call_args = {
        "connection_id": TELNYX_CATO_TEXML_APP_ID,
        "From": TELNYX_FROM_NUMBER,
        "To": HANDOFF_TO_NUMBER,
        "AIAssistantId": TELNYX_CATO_ASSISTANT_ID,
        "AIAssistantDynamicVariables": {
            "call_mode": "human_handoff",
            "initial_greeting": briefing_greeting,
            "visitor_name": payload.visitor_name,
            "business": payload.business,
            "visitor_email": payload.visitor_email,
            "visitor_phone": payload.visitor_phone,
            "goal": payload.goal,
            "budget_range": payload.budget_range,
            "source_site": payload.source_site,
            "handoff_notes": f"{payload.urgency_reason} {payload.transcript_summary}".strip(),
        },
    }
    try:
        code = f"return await call_tool('InitiateTexmlAICall', {json.dumps(ai_call_args)})"
        res = await telnyx.call_tool(tool_name="execute", arguments={"code": code})
        parsed = _extract_json(res)
        ref = ""
        if isinstance(parsed, dict):
            data = parsed.get("data", parsed)
            if isinstance(data, dict):
                ref = str(data.get("call_sid") or data.get("call_control_id") or data.get("id") or "initiated")
        return {"initiated": True, "call_reference": ref or "initiated"}
    except Exception:
        safe_say = html.escape(briefing_greeting)
        texml_args = {
            "connection_id": TELNYX_CATO_TEXML_APP_ID,
            "From": TELNYX_FROM_NUMBER,
            "To": HANDOFF_TO_NUMBER,
            "Texml": f"<Response><Say voice='Polly.Matthew-Neural'>{safe_say}</Say></Response>",
        }
        code_fb = f"return await call_tool('CreateTexmlCall', {json.dumps(texml_args)})"
        res_fb = await telnyx.call_tool(tool_name="execute", arguments={"code": code_fb})
        parsed_fb = _extract_json(res_fb)
        ref_fb = str(parsed_fb.get("call_sid", "queued")) if isinstance(parsed_fb, dict) else "queued"
        return {"initiated": True, "call_reference": ref_fb}


@workflows.activity(name="send-handoff-email")
async def send_handoff_email_activity(
    payload: HumanHandoffInput,
    call_reference: str,
    notion_lead_url: str,
    zoho: ToolCallClient = Depends(zoho_connector),
) -> bool:
    """Email full hand-off context & transcript summary to tim@oubliai.com."""
    esc = html.escape
    html_body = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:28px 18px;background:#fafbfe;color:#0a0c12;font-family:-apple-system,BlinkMacSystemFont,'Inter',Segoe UI,sans-serif;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e4e8f2;padding:32px;">
    <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#2e4bff;font-weight:600;">CATO LABS · IMMEDIATE HUMAN HAND-OFF</p>
    <h1 style="margin:0 0 16px;font-size:22px;color:#0a0c12;">{esc(payload.visitor_name)} ({esc(payload.business)})</h1>
    <p style="margin:0 0 18px;color:#363b49;"><strong>Reason:</strong> {esc(payload.urgency_reason)}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;width:140px;">Phone</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;font-weight:600;"><a href="tel:{esc(payload.visitor_phone)}" style="color:#2e4bff;">{esc(payload.visitor_phone)}</a></td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Email</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;"><a href="mailto:{esc(payload.visitor_email)}" style="color:#2e4bff;">{esc(payload.visitor_email)}</a></td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Business</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;">{esc(payload.business)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Goal</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;">{esc(payload.goal)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Budget Range</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;">{esc(payload.budget_range)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Source Site</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;">{esc(payload.source_site)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #edf0f7;color:#656d80;">Voice Alert</td><td style="padding:8px 0;border-bottom:1px solid #edf0f7;">Called {HANDOFF_TO_NUMBER} ({esc(call_reference)})</td></tr>
      <tr><td style="padding:8px 0;color:#656d80;">Notion Lead</td><td style="padding:8px 0;"><a href="{esc(notion_lead_url or CATO_SITE_URL)}" style="color:#2e4bff;">{esc(notion_lead_url or 'Logged in Generated Leads')}</a></td></tr>
    </table>
    {f"<h3 style='font-size:14px;margin:20px 0 6px;'>Conversation Summary</h3><p style='margin:0;color:#363b49;white-space:pre-wrap;'>{esc(payload.transcript_summary)}</p>" if payload.transcript_summary else ""}
    {f"<h3 style='font-size:14px;margin:20px 0 6px;'>Additional Notes</h3><p style='margin:0;color:#363b49;white-space:pre-wrap;'>{esc(payload.notes)}</p>" if payload.notes else ""}
  </div>
</body>
</html>"""
    return await send_zoho_email_activity(
        to_address=OWNER_EMAIL,
        subject=f"[Hand-Off] {payload.visitor_name} ({payload.business}) · {payload.visitor_phone}",
        html_content=html_body,
        zoho=zoho,
    )


async def _call_connector_with_scheduled_fallback(
    slot_client: ToolCallClient,
    connector_name: str,
    tool_name: str,
    arguments: dict[str, Any],
) -> Any:
    """Use the workflow ToolCallClient first; fall back to beta.connectors.call_tool_async on cron runs."""
    try:
        return await slot_client.call_tool(tool_name=tool_name, arguments=arguments)
    except Exception:
        m_client = get_mistral_client()
        return await m_client.beta.connectors.call_tool_async(
            connector_id_or_name=connector_name,
            tool_name=tool_name,
            arguments=arguments,
        )


@workflows.activity(name="compile-and-send-daily-digest")
async def compile_and_send_daily_digest_activity(
    params: DailyDigestInput,
    notion: ToolCallClient = Depends(notion_connector),
    zoho: ToolCallClient = Depends(zoho_connector),
) -> DailyDigestOutput:
    """Query Notion leads & meetings + Zoho Calendar, synthesize with GLM 5.3 Flash, email & archive in Notion Docs."""
    now_pt = datetime.now(tz=PT_TZ)
    end_pt = now_pt + timedelta(days=max(1, params.lookahead_days))
    date_label = now_pt.strftime("%A, %B %-d, %Y")

    leads_raw = await _call_connector_with_scheduled_fallback(
        notion,
        "notion",
        "notion-query-data-sources",
        {
            "data": {
                "data_source_urls": [NOTION_LEADS_COLLECTION],
                "query": f"SELECT * FROM [{NOTION_LEADS_COLLECTION}]",
            }
        },
    )
    meetings_raw = await _call_connector_with_scheduled_fallback(
        notion,
        "notion",
        "notion-query-data-sources",
        {
            "data": {
                "data_source_urls": [NOTION_MEETINGS_COLLECTION],
                "query": f"SELECT * FROM [{NOTION_MEETINGS_COLLECTION}]",
            }
        },
    )
    cal_raw = await _call_connector_with_scheduled_fallback(
        zoho,
        "zohomcp_mail_calendar_campaigns_fca1",
        "ZohoCalendar_get_event",
        {
            "query_params": {
                "caluid": ZOHO_CALUID,
                "start": now_pt.strftime("%Y%m%d"),
                "end": end_pt.strftime("%Y%m%d"),
                "byinstance": "true",
            }
        },
    )

    leads_text = _extract_text(leads_raw)
    meetings_text = _extract_text(meetings_raw)
    cal_text = _extract_text(cal_raw)

    prompt = (
        f"Today is {date_label} ({DISCOVERY_TIMEZONE}). Prepare a crisp, executive Cato Labs Daily Digest in clean Markdown "
        f"with four sections:\n"
        f"1. **Pipeline Snapshot** (new & callback-requested leads in 💙 Generated Leads)\n"
        f"2. **Upcoming Discovery & Calendar** (next {params.lookahead_days} days from Zoho Calendar & Notion Meetings)\n"
        f"3. **Priority Follow-Ups & Hand-Offs**\n"
        f"4. **Recommended Actions Today**\n\n"
        f"Ground every item strictly in the live workspace data below — never invent leads or events.\n\n"
        f"--- NOTION GENERATED LEADS ---\n{leads_text}\n\n"
        f"--- NOTION MEETINGS ---\n{meetings_text}\n\n"
        f"--- ZOHO CALENDAR ({params.lookahead_days} DAYS) ---\n{cal_text}"
    )

    summary_md = ""
    try:
        m_client = get_mistral_client()
        chat_res = await m_client.chat.complete_async(
            model=PRIMARY_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": "You are the Cato Labs executive operations chief. Write concise, high-signal briefings.",
                },
                {"role": "user", "content": prompt},
            ],
        )
        choice_content = chat_res.choices[0].message.content if chat_res.choices else ""
        if isinstance(choice_content, str):
            summary_md = choice_content.strip()
        elif isinstance(choice_content, list):
            summary_md = "".join(getattr(c, "text", "") for c in choice_content).strip()
    except Exception as exc:
        summary_md = (
            f"# Cato Labs Daily Digest — {date_label}\n\n"
            f"*(Automated synthesis fallback: {exc})*\n\n"
            f"## Notion Leads\n{leads_text}\n\n"
            f"## Zoho Calendar\n{cal_text}"
        )

    # Convert simple markdown headings/bullets to clean HTML for Zoho Mail
    html_lines: list[str] = []
    for line in summary_md.splitlines():
        stripped = line.strip()
        if stripped.startswith("### "):
            html_lines.append(f"<h3 style='margin:18px 0 6px;font-size:15px;color:#0a0c12;'>{html.escape(stripped[4:])}</h3>")
        elif stripped.startswith("## "):
            html_lines.append(f"<h2 style='margin:22px 0 8px;font-size:17px;color:#2e4bff;'>{html.escape(stripped[3:])}</h2>")
        elif stripped.startswith("# "):
            html_lines.append(f"<h1 style='margin:0 0 12px;font-size:21px;color:#0a0c12;'>{html.escape(stripped[2:])}</h1>")
        elif stripped.startswith(("- ", "* ")):
            html_lines.append(f"<div style='margin:4px 0 4px 12px;color:#363b49;'>• {html.escape(stripped[2:])}</div>")
        elif stripped:
            html_lines.append(f"<p style='margin:8px 0;color:#363b49;'>{html.escape(stripped)}</p>")

    html_email = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:28px 18px;background:#fafbfe;color:#0a0c12;font-family:-apple-system,BlinkMacSystemFont,'Inter',Segoe UI,sans-serif;line-height:1.6;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e4e8f2;padding:34px;">
    <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#2e4bff;font-weight:600;">CATO LABS · EXECUTIVE DAILY DIGEST · {html.escape(date_label)}</p>
    {''.join(html_lines)}
    <hr style="border:none;border-top:1px solid #edf0f7;margin:26px 0 14px;" />
    <p style="margin:0;font-size:12px;color:#8a92a6;">Synthesized with Mistral {PRIMARY_MODEL} · Archived in Notion Docs</p>
  </div>
</body>
</html>"""

    subject = f"Cato Labs Daily Digest — {now_pt.strftime('%b %-d, %Y')}"
    await _call_connector_with_scheduled_fallback(
        zoho,
        "zohomcp_mail_calendar_campaigns_fca1",
        "ZohoMail_send_mail",
        {
            "path_variables": {"accountId": "me"},
            "body": {
                "fromAddress": OWNER_EMAIL,
                "toAddress": params.recipient_email or OWNER_EMAIL,
                "subject": subject,
                "content": html_email,
                "contentType": "html",
            },
        },
    )

    doc_res = await _call_connector_with_scheduled_fallback(
        notion,
        "notion",
        "notion-create-pages",
        {
            "parent": {"type": "data_source_id", "data_source_id": NOTION_DOCS_DS_ID},
            "pages": [
                {
                    "properties": {
                        "Name": f"Cato Labs Daily Digest — {now_pt.strftime('%Y-%m-%d')}",
                        "Type": "Update",
                    },
                    "content": summary_md,
                }
            ],
        },
    )
    doc_txt = _extract_text(doc_res)
    doc_match = _NOTION_URL_RE.search(doc_txt)

    return DailyDigestOutput(
        digest_date_pt=now_pt.strftime("%Y-%m-%d"),
        subject=subject,
        email_sent=True,
        notion_doc_url=doc_match.group(0) if doc_match else "",
        summary_markdown=summary_md,
    )
