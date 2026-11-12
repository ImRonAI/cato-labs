"""FastAPI HTTP-to-SSE bridge connecting Next.js (/api/studio-agent & /api/studio-greeting)
to the deployed Mistral Agent (`cato-studio-concierge`, zai-glm-5-3-flash) and durable Mistral Workflows.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import mistralai.agents as agents
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from mistralai.client import Mistral
from pydantic import BaseModel, Field

from main import (
    AvailabilityCheckInput,
    AvailabilityCheckOutput,
    OpenSlotEntry,
    PageKnowledgeBaseInput,
    PageKnowledgeBaseOutput,
    WorkflowBookingResult,
    WorkflowDigestResult,
    WorkflowFollowUpResult,
    WorkflowHandoffResult,
    agent as local_agent,
    check_discovery_availability,
    get_page_knowledge_base,
    trigger_daily_digest,
    trigger_follow_up_sequence,
    trigger_human_handoff,
    trigger_qualify_book_confirm,
)
from workflows_pkg.activities import (
    _collect_busy_windows,
    _compute_open_slots,
    _extract_json,
    _format_zoho_local,
    _parse_pt_datetime,
)
from workflows_pkg.constants import (
    DISCOVERY_DURATION_MINUTES,
    DISCOVERY_TIMEZONE,
    OWNER_EMAIL,
    PRIMARY_MODEL,
    ZOHO_CALUID,
)
from workflows_pkg.models import (
    DailyDigestInput,
    FollowUpSequenceInput,
    HumanHandoffInput,
    QualifyBookConfirmInput,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
KB_DIR = REPO_ROOT / "lib" / "studio-kb"
PT_TZ = ZoneInfo(DISCOVERY_TIMEZONE)


def _load_env_local() -> None:
    for candidate in (REPO_ROOT / ".env.local", REPO_ROOT / ".env"):
        if not candidate.is_file():
            continue
        for raw_line in candidate.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val


_load_env_local()


def _mistral_api_key() -> str:
    key = os.environ.get("MISTRAL_API_KEY", "").strip()
    if not key:
        raise RuntimeError("MISTRAL_API_KEY is not configured in environment or .env.local.")
    return key


def _mistral_client() -> Mistral:
    return Mistral(api_key=_mistral_api_key())


app = FastAPI(title="Cato Labs Mistral Concierge Bridge", version="1.0.0")

# In-memory handles for sessions running in fallback local mode while remote deployment warms up
_LOCAL_SESSIONS: dict[str, agents.Session] = {}


class GreetingRequest(BaseModel):
    instructions: str
    input: str = "(The visitor has just opened the page. Send your proactive welcome message now.)"


class ToolInvokeRequest(BaseModel):
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    input: str
    previous_response_id: str | None = None
    slug: str | None = None
    brand: str = "Cato Labs Studio"
    concierge: str = "Studio Concierge"
    tone: str = ""
    facts: str = ""
    visitor_line: str = ""
    kb: str | None = None
    prefer_deployed: bool = Field(default=True)


def _read_kb_from_disk(slug: str | None) -> str:
    if not slug:
        return ""
    clean = "".join(c for c in slug.lower() if c.isalnum() or c == "-")
    if not clean:
        return ""
    target = KB_DIR / f"{clean}.md"
    if target.is_file():
        return target.read_text(encoding="utf-8")
    return ""


def _normalize_tool_name(raw_name: str | None) -> str:
    if not raw_name:
        return "tool"
    name = raw_name.strip()
    for suffix in (
        "generate_prefab_ui",
        "search_prefab_components",
        "get_page_knowledge_base",
        "check_discovery_availability",
        "trigger_qualify_book_confirm",
        "trigger_follow_up_sequence",
        "trigger_human_handoff",
        "trigger_daily_digest",
    ):
        if name == suffix or name.endswith(f".{suffix}"):
            return suffix
    if "." in name:
        return name.split(".", 1)[1]
    return name


def _content_blocks_to_text(blocks: tuple[Any, ...] | list[Any]) -> str:
    parts: list[str] = []
    for block in blocks:
        txt = getattr(block, "text", None)
        if isinstance(txt, str) and txt:
            parts.append(txt)
        elif isinstance(block, dict) and isinstance(block.get("text"), str):
            parts.append(block["text"])
    return "\n".join(parts)


async def _query_zoho_availability(args: AvailabilityCheckInput) -> AvailabilityCheckOutput:
    client = _mistral_client()
    now_pt = datetime.now(tz=PT_TZ)
    try:
        anchor_pt = _parse_pt_datetime(args.anchor_date_iso) if args.anchor_date_iso.strip() else now_pt
    except Exception:
        anchor_pt = now_pt

    range_start = max(anchor_pt, now_pt).replace(hour=0, minute=0, second=0, microsecond=0)
    span_days = max(1, args.days_ahead) + 4
    range_end = (range_start + timedelta(days=span_days)).replace(hour=23, minute=59, second=59, microsecond=0)

    busy_windows: list[tuple[datetime, datetime]] = []
    try:
        fb_raw = await client.beta.connectors.call_tool_async(
            connector_id_or_name="zohomcp_mail_calendar_campaigns_fca1",
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
        ev_raw = await client.beta.connectors.call_tool_async(
            connector_id_or_name="zohomcp_mail_calendar_campaigns_fca1",
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

    open_slots = _compute_open_slots(anchor_pt, busy_windows, days_ahead=max(1, args.days_ahead))
    formatted = []
    for iso_slot in open_slots:
        dt = _parse_pt_datetime(iso_slot)
        end_dt = dt + timedelta(minutes=DISCOVERY_DURATION_MINUTES)
        formatted.append(
            OpenSlotEntry(
                slot_start_iso=iso_slot,
                label_pt=f"{dt.strftime('%a, %b %-d · %-I:%M %p')} – {end_dt.strftime('%-I:%M %p PT')}",
            )
        )
    return AvailabilityCheckOutput(
        timezone=DISCOVERY_TIMEZONE,
        duration_minutes=DISCOVERY_DURATION_MINUTES,
        hours="Monday–Friday, 9:00 AM – 5:00 PM PT",
        open_slots=formatted,
    )


async def _run_qualify_book_confirm_workflow(args: QualifyBookConfirmInput) -> WorkflowBookingResult:
    client = _mistral_client()
    started = await client.workflows.execute_workflow_async(
        workflow_identifier="cato-qualify-book-confirm",
        deployment_name="cato-workflows-worker",
        input=args.model_dump(),
        wait_for_result=False,
    )
    execution_id = str(getattr(started, "execution_id", ""))

    while True:
        await asyncio.sleep(1.2)
        try:
            q_res = await client.workflows.executions.query_workflow_execution_async(
                execution_id=execution_id,
                name="booking_status",
            )
            snap = getattr(q_res, "result", None)
            if isinstance(snap, dict) and snap.get("ready"):
                merged = {k: v for k, v in snap.items() if k in WorkflowBookingResult.model_fields}
                return WorkflowBookingResult(execution_id=execution_id, **merged)
        except Exception:
            pass

        exec_info = await client.workflows.executions.get_workflow_execution_async(
            execution_id=execution_id,
        )
        status_str = str(getattr(exec_info, "status", "")).upper()
        if any(term in status_str for term in ("COMPLETED", "FAILED", "CANCELED", "TERMINATED", "TIMED_OUT")):
            res_obj = getattr(exec_info, "result", None)
            if isinstance(res_obj, dict):
                merged = {k: v for k, v in res_obj.items() if k in WorkflowBookingResult.model_fields}
                return WorkflowBookingResult(execution_id=execution_id, **merged)
            return WorkflowBookingResult(
                execution_id=execution_id,
                booked="COMPLETED" in status_str,
                reason=f"Workflow finished with status {status_str}.",
            )


async def _run_follow_up_workflow(args: FollowUpSequenceInput) -> WorkflowFollowUpResult:
    client = _mistral_client()
    started = await client.workflows.execute_workflow_async(
        workflow_identifier="cato-follow-up-sequence",
        deployment_name="cato-workflows-worker",
        input=args.model_dump(),
        wait_for_result=False,
    )
    return WorkflowFollowUpResult(
        started=True,
        workflow="cato-follow-up-sequence",
        execution_id=str(getattr(started, "execution_id", "")),
        first_delay_hours=args.first_delay_hours,
        second_delay_hours=args.second_delay_hours,
    )


async def _run_human_handoff_workflow(args: HumanHandoffInput) -> WorkflowHandoffResult:
    client = _mistral_client()
    completed = await client.workflows.execute_workflow_async(
        workflow_identifier="cato-human-handoff",
        deployment_name="cato-workflows-worker",
        input=args.model_dump(),
        wait_for_result=True,
    )
    result = getattr(completed, "result", None)
    exec_id = str(getattr(completed, "execution_id", ""))
    if isinstance(result, dict):
        merged = {k: v for k, v in result.items() if k in WorkflowHandoffResult.model_fields}
        return WorkflowHandoffResult(execution_id=exec_id, **merged)
    return WorkflowHandoffResult(execution_id=exec_id)


async def _run_daily_digest_workflow(args: DailyDigestInput) -> WorkflowDigestResult:
    client = _mistral_client()
    completed = await client.workflows.execute_workflow_async(
        workflow_identifier="cato-daily-digest",
        deployment_name="cato-workflows-worker",
        input=args.model_dump(),
        wait_for_result=True,
    )
    result = getattr(completed, "result", None)
    exec_id = str(getattr(completed, "execution_id", ""))
    if isinstance(result, dict):
        merged = {k: v for k, v in result.items() if k in WorkflowDigestResult.model_fields}
        return WorkflowDigestResult(execution_id=exec_id, **merged)
    return WorkflowDigestResult(execution_id=exec_id)


def _build_session_customization(req: ChatRequest) -> agents.SessionAgentCustomization:
    lines = [
        f"# Active Flagship Showcase Session",
        f"- Brand: {req.brand}",
        f"- Concierge Name: {req.concierge}",
        f"- Showcase Slug: {req.slug or 'catolabs'}",
    ]
    if req.tone:
        lines.append(f"- Editorial Voice & Tone: {req.tone}")
    if req.visitor_line:
        lines.append(
            f"- Approximate Visitor Signals (use gently for nearest location or timezone math only; never mention IP/tracking): {req.visitor_line}"
        )
    if req.facts:
        lines.append(f"\n# Quick Page Facts\n{req.facts}")
    lines.append(
        "\nWhenever the visitor asks about menus, courses, specifications, pricing tiers, team members, addresses, or policies, "
        "call `get_page_knowledge_base` first so your answer quotes the complete published showcase content accurately."
    )
    return agents.SessionAgentCustomization(additional_instructions="\n".join(lines))


def _build_client_tool_answers(req: ChatRequest) -> agents.ClientToolAnswers:
    async def handle_kb(args: PageKnowledgeBaseInput) -> PageKnowledgeBaseOutput:
        target_slug = args.slug.strip() or (req.slug or "")
        if (not args.slug.strip() or args.slug.strip() == (req.slug or "")) and req.kb:
            return PageKnowledgeBaseOutput(slug=target_slug or "active-page", knowledge_base_markdown=req.kb)
        disk_kb = _read_kb_from_disk(target_slug)
        if disk_kb:
            return PageKnowledgeBaseOutput(slug=target_slug, knowledge_base_markdown=disk_kb)
        return PageKnowledgeBaseOutput(
            slug=target_slug or "unknown",
            knowledge_base_markdown=req.kb or req.facts or "No extended knowledge base markdown found; rely on page facts.",
        )

    return agents.ClientToolAnswers(
        get_page_knowledge_base.answer(handle_kb),
        check_discovery_availability.answer(_query_zoho_availability),
        trigger_qualify_book_confirm.answer(_run_qualify_book_confirm_workflow),
        trigger_follow_up_sequence.answer(_run_follow_up_workflow),
        trigger_human_handoff.answer(_run_human_handoff_workflow),
        trigger_daily_digest.answer(_run_daily_digest_workflow),
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "model": PRIMARY_MODEL, "agent": "cato-studio-concierge"}


@app.post("/tool")
async def invoke_tool_from_ui(req: ToolInvokeRequest) -> dict[str, Any]:
    """Execute a Cato Labs concierge/workflow tool or Telnyx connector tool directly from an interactive Prefab UI card."""
    clean = _normalize_tool_name(req.name)
    args = req.arguments or {}
    try:
        if clean == "get_page_knowledge_base":
            parsed = PageKnowledgeBaseInput.model_validate(args)
            kb_md = _read_kb_from_disk(parsed.slug)
            data = PageKnowledgeBaseOutput(slug=parsed.slug or "studio", knowledge_base_markdown=kb_md).model_dump()
        elif clean == "check_discovery_availability":
            data = (await _query_zoho_availability(AvailabilityCheckInput.model_validate(args))).model_dump()
        elif clean == "trigger_qualify_book_confirm":
            data = (await _run_qualify_book_confirm_workflow(QualifyBookConfirmInput.model_validate(args))).model_dump()
        elif clean == "trigger_follow_up_sequence":
            data = (await _run_follow_up_workflow(FollowUpSequenceInput.model_validate(args))).model_dump()
        elif clean == "trigger_human_handoff":
            data = (await _run_human_handoff_workflow(HumanHandoffInput.model_validate(args))).model_dump()
        elif clean == "trigger_daily_digest":
            data = (await _run_daily_digest_workflow(DailyDigestInput.model_validate(args))).model_dump()
        else:
            client = _mistral_client()
            raw = await client.beta.connectors.call_tool_async(
                connector_id_or_name="fastmcp_telnyx_mcp_a353",
                tool_name=clean,
                arguments=args,
            )
            extracted = _extract_json(raw)
            data = extracted if isinstance(extracted, dict) else {"result": extracted}

        return {
            "isError": False,
            "structuredContent": data,
            "content": [{"type": "text", "text": json.dumps(data, default=str)}],
        }
    except Exception as exc:
        return {
            "isError": True,
            "content": [{"type": "text", "text": str(exc)}],
        }


@app.post("/greeting")
async def generate_greeting(req: GreetingRequest) -> dict[str, Any]:
    try:
        client = _mistral_client()
        res = await client.chat.complete_async(
            model=PRIMARY_MODEL,
            messages=[
                {"role": "system", "content": req.instructions},
                {"role": "user", "content": req.input},
            ],
            temperature=0.65,
        )
        content = res.choices[0].message.content if res.choices else ""
        if isinstance(content, list):
            text = "".join(getattr(c, "text", "") for c in content).strip()
        else:
            text = str(content or "").strip()
        return {"text": text, "responseId": None, "model": PRIMARY_MODEL}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/chat")
async def stream_chat(req: ChatRequest) -> StreamingResponse:
    if not req.input.strip():
        raise HTTPException(status_code=400, detail="A message is required.")

    api_key = _mistral_api_key()
    os.environ["MISTRAL_API_KEY"] = api_key

    answers = _build_client_tool_answers(req)
    customization = _build_session_customization(req)

    async def event_generator():
        queue: asyncio.Queue[str | None] = asyncio.Queue()
        pending_calls: dict[str, tuple[str, Any]] = {}
        emitted_text_deltas = False

        def emit(payload: dict[str, Any]) -> None:
            queue.put_nowait(f"data: {json.dumps(payload, default=str)}\n\n")

        async def on_event(evt: Any) -> None:
            nonlocal emitted_text_deltas
            if isinstance(evt, agents.TextDelta):
                if evt.text:
                    emitted_text_deltas = True
                    emit({"type": "response.output_text.delta", "delta": evt.text})
                return

            if isinstance(evt, (agents.EntryAdded, agents.EntryCompleted)):
                entry = evt.entry
                if isinstance(entry, agents.ToolCallEntry):
                    clean_name = _normalize_tool_name(entry.name)
                    pending_calls[entry.tool_call_id] = (clean_name, entry.arguments)
                    if isinstance(evt, agents.EntryAdded):
                        emit(
                            {
                                "type": "response.output_item.added",
                                "item": {
                                    "type": "mcp_call",
                                    "id": entry.tool_call_id,
                                    "name": clean_name,
                                    "arguments": entry.arguments,
                                },
                            }
                        )
                    return

                if isinstance(evt, agents.EntryCompleted) and isinstance(entry, agents.ToolResultEntry):
                    saved_name, saved_args = pending_calls.get(
                        entry.tool_call_id,
                        (_normalize_tool_name(entry.name), {}),
                    )
                    text_out = _content_blocks_to_text(entry.content)
                    if entry.structured_content is not None:
                        out_obj: Any = {
                            "structuredContent": entry.structured_content,
                            "content": [{"type": "text", "text": text_out}] if text_out else [],
                        }
                    else:
                        out_obj = text_out or "Completed"

                    emit(
                        {
                            "type": "response.output_item.done",
                            "item": {
                                "type": "mcp_call",
                                "id": entry.tool_call_id,
                                "name": saved_name,
                                "arguments": saved_args,
                                "output": out_obj,
                                **({"error": text_out or "Tool execution failed"} if entry.is_error else {}),
                            },
                        }
                    )

        async def runner() -> None:
            nonlocal emitted_text_deltas
            try:
                session: agents.Session | None = None
                deployed: agents.Agent | None = None
                prev_id = (req.previous_response_id or "").strip()
                resumed_existing = False

                if prev_id and prev_id in _LOCAL_SESSIONS:
                    session = _LOCAL_SESSIONS[prev_id]
                    resumed_existing = True
                elif req.prefer_deployed:
                    try:
                        deployed = agents.Agent.load_from(
                            agent_name="cato-studio-concierge",
                            api_key=api_key,
                        )
                        if prev_id and len(prev_id) == 36 and "-" in prev_id:
                            try:
                                session = deployed.session(prev_id, on_client_tool=answers)
                                resumed_existing = True
                            except Exception:
                                session = None
                        if session is None:
                            session = await deployed.start_session(
                                agent=customization,
                                on_client_tool=answers,
                            )
                    except Exception:
                        session = None

                if session is None:
                    session = await local_agent.start_session(
                        agent=customization,
                        on_client_tool=answers,
                    )
                    _LOCAL_SESSIONS[session.id] = session

                emit({"type": "response.created", "response": {"id": session.id}})
                try:
                    turn_state = await session.run(req.input.strip(), on_event=on_event)
                except Exception:
                    if resumed_existing and deployed is not None and not emitted_text_deltas:
                        session = await deployed.start_session(
                            agent=customization,
                            on_client_tool=answers,
                        )
                        emit({"type": "response.created", "response": {"id": session.id}})
                        turn_state = await session.run(req.input.strip(), on_event=on_event)
                    else:
                        raise

                if not emitted_text_deltas:
                    fallback_out = getattr(turn_state, "text", None) or getattr(turn_state, "output", None)
                    if isinstance(fallback_out, str) and fallback_out.strip():
                        emit({"type": "response.output_text.delta", "delta": fallback_out})
                    else:
                        turn_err = getattr(turn_state, "error", None)
                        if turn_err:
                            emit({"type": "response.output_text.delta", "delta": f"*(Concierge notice: {turn_err})*"})
            except Exception as exc:
                emit(
                    {
                        "type": "response.output_text.delta",
                        "delta": f"\n\n*(Concierge service notice: {exc})*",
                    }
                )
            finally:
                queue.put_nowait("data: [DONE]\n\n")
                queue.put_nowait(None)

        task = asyncio.create_task(runner())
        try:
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                yield chunk
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
