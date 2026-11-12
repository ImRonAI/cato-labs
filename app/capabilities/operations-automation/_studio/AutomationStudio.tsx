'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import {
  INITIAL_LEDGER_RECORDS,
  MACHINE_STATIONS,
  PROCESS_PRESETS,
  STUDIO_COPY,
  WORKFLOW_NODES,
  type LedgerRecord,
  type NodeId,
  type ProcessId,
} from '@/lib/content/overhaul/cap-ops';
import {
  opsBus,
  setOpsProcess,
  setOpsRunState,
  setOpsStation,
  setOpsStationEnabled,
} from '@/components/webgl/scenes/capabilities/children/operations-automation/ops-bus';

/* ---------- Deterministic Payload Parser & Rule Engine ---------- */

export interface ParsedPayloadResult {
  hashHex: string;
  byteLength: number;
  wordCount: number;
  entity: string;
  reference: string;
  valueOrTier: string;
  intentSummary: string;
  amountUsd: number | null;
  confidence: number;
  rules: {
    id: string;
    label: string;
    expression: string;
    passed: boolean;
    detail: string;
  }[];
  escalated: boolean;
  escalationReason: string | null;
  routeTarget: string;
  draftSubject: string;
  draftBody: string;
}

function fnv1aHex(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return '0x' + (h >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function analyzePayload(
  processId: ProcessId,
  rawText: string,
  enabled: Record<NodeId, boolean>,
  forceEscalate: boolean,
): ParsedPayloadResult {
  const preset = PROCESS_PRESETS[processId];
  const trimmed = rawText.trim();
  const byteLength = new TextEncoder().encode(rawText).length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const hashHex = fnv1aHex(`${processId}:${rawText}`);

  if (!enabled.extract) {
    const escalated = forceEscalate;
    return {
      hashHex,
      byteLength,
      wordCount,
      entity: 'Raw unparsed sender (Extractor bypassed)',
      reference: `RAW-${hashHex.replace('0x', '')}`,
      valueOrTier: 'Unparsed payload',
      intentSummary: 'Schema extraction station bypassed by operator toggle.',
      amountUsd: null,
      confidence: 0.42,
      rules: [
        {
          id: 'schema-present',
          label: 'Structured Schema Check',
          expression: 'extract_node.enabled == true',
          passed: false,
          detail: 'Extractor disabled — forwarding raw text buffer.',
        },
      ],
      escalated,
      escalationReason: escalated
        ? 'Manual branch override to Human Escalation Spur'
        : null,
      routeTarget: escalated
        ? 'Human Escalation Spur · Ops Triage Desk'
        : `Unverified Pass-Through → ${preset.targetSystem}`,
      draftSubject: `[${preset.shortLabel}] Raw payload forwarded (${hashHex})`,
      draftBody: `Payload ingested (${byteLength} bytes) with Station 02 (Extract) bypassed.\nRaw message attached for downstream review:\n"${trimmed}"`,
    };
  }

  // Deterministic regex extraction on the actual string
  const fromMatch = rawText.match(
    /(?:From|Vendor|Client|Patient\/Client|Company):\s*([^|\n]+)/i,
  );
  const emailMatch = rawText.match(/([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/);
  const companyMatch = rawText.match(/Company:\s*([^|\n]+)/i);

  const entity = companyMatch
    ? companyMatch[1].trim()
    : fromMatch
      ? fromMatch[1].trim()
      : emailMatch
        ? emailMatch[1].trim()
        : trimmed.split(/[|\n.]/)[0]?.trim() || 'Inbound Counterparty';

  const invMatch = rawText.match(/Invoice:\s*([A-Z0-9-]+)/i);
  const poMatch = rawText.match(/PO:\s*([A-Z0-9-]+)/i);
  const ticketMatch = rawText.match(/Ticket\s*(#[0-9A-Za-z-]+)/i);
  const reqMatch = rawText.match(/Requested:\s*([^|\n]+)/i);
  const timeMatch = rawText.match(/Timeline:\s*([^|\n]+)/i);

  const reference = invMatch
    ? `${invMatch[1]}${poMatch ? ` / ${poMatch[1]}` : ''}`
    : ticketMatch
      ? `Ticket ${ticketMatch[1]}`
      : reqMatch
        ? reqMatch[1].trim()
        : timeMatch
          ? timeMatch[1].trim()
          : `REF-${hashHex.replace('0x', '')}`;

  const moneyMatch = rawText.match(/\$(\d[\d,]*(?:\.\d{2})?)(?:\s*ARR)?/i);
  const amountUsd = moneyMatch
    ? parseFloat(moneyMatch[1].replace(/,/g, ''))
    : null;
  const seatsMatch = rawText.match(/(\d[\d,]*\s*seats)/i);
  const planMatch = rawText.match(
    /\b(Enterprise(?:\s*SLA)?|Pro Plan|Tier-1|Half-day onsite|60 min)\b/i,
  );

  const valueOrTier = moneyMatch
    ? `${moneyMatch[0]}${seatsMatch ? ` · ${seatsMatch[1]}` : ''}`
    : seatsMatch
      ? seatsMatch[1]
      : planMatch
        ? planMatch[1]
        : 'Standard Tier';

  const needMatch = rawText.match(/(?:Need|Subject|Service|Line items):\s*([^|\n]+)/i);
  const intentSummary = needMatch
    ? needMatch[1].trim()
    : trimmed || 'Operational workflow payload';

  // Explicit rule evaluation
  const hasComplianceException =
    /\b(air-gapped|fedramp|waiver|indemnity|baa|hipaa|addendum|overage|surcharge|unscheduled)\b/i.test(
      rawText,
    );
  const hasUrgencyException =
    /\b(urgent|p1|outage|stalled|stuck|breach|emergency|critical|tomorrow)\b/i.test(
      rawText,
    );
  const overInvoiceCap =
    processId === 'invoice-approval' && amountUsd !== null && amountUsd > 15000;
  const budgetTbd = /\b(tbd|procurement review)\b/i.test(rawText);

  const rules = [
    {
      id: 'threshold-check',
      label:
        processId === 'invoice-approval'
          ? 'AP Auto-Approval Ceiling (<= $15,000)'
          : 'Commercial Scope & Budget Gate',
      expression:
        processId === 'invoice-approval'
          ? 'amount_usd <= 15000 && po_matched == true'
          : 'scope_defined == true && budget != "TBD"',
      passed: !overInvoiceCap && !budgetTbd,
      detail: overInvoiceCap
        ? `Amount $${amountUsd?.toLocaleString()} exceeds $15,000 auto-post cap`
        : budgetTbd
          ? 'Budget marked TBD / under procurement review'
          : 'Within automated commercial threshold',
    },
    {
      id: 'policy-compliance',
      label: 'Standard Terms & Policy Gate',
      expression: 'custom_legal_terms == false && surcharge_variance == 0',
      passed: !hasComplianceException,
      detail: hasComplianceException
        ? 'Detected non-standard compliance, addendum, BAA, or billing variance flag'
        : 'No custom legal waivers or billing surcharges detected',
    },
    {
      id: 'sla-severity',
      label: 'SLA Severity & Window Gate',
      expression: 'priority != "P1_OUTAGE" && turnaround >= 24h',
      passed: !hasUrgencyException,
      detail: hasUrgencyException
        ? 'High-urgency / P1 incident or <24h rush constraint flagged'
        : 'Standard SLA execution window',
    },
  ];

  const ruleTriggeredEscalation =
    enabled.classify && rules.some((r) => !r.passed);
  const escalated = forceEscalate || ruleTriggeredEscalation;

  const failedRule = rules.find((r) => !r.passed);
  const escalationReason = forceEscalate
    ? 'Operator forced Escalation Spur override'
    : failedRule
      ? failedRule.detail
      : null;

  const confidence = escalated ? 0.96 : 0.99;

  const routeTarget = escalated
    ? `Human Escalation Spur → ${
        processId === 'invoice-approval'
          ? 'Controller Sign-off Queue'
          : processId === 'support-triage'
            ? 'P1 Incident Commander Bridge'
            : processId === 'appointment-scheduling'
              ? 'Senior Clinical/Ops Coordinator'
              : 'Deal Desk & Legal Review'
      }`
    : `Auto-Rail → ${preset.targetSystem}`;

  const draftSubject = escalated
    ? `[ESCALATION · ${preset.shortLabel.toUpperCase()}] Human review required: ${entity} (${reference})`
    : `[COMMITTED · ${preset.shortLabel.toUpperCase()}] Automated completion: ${entity} (${reference})`;

  const draftBody = escalated
    ? `To: ${preset.notifyChannel} (Human-in-the-Loop Spur)\nTrigger Reason: ${escalationReason}\nEntity: ${entity} | Ref: ${reference} | Value/Tier: ${valueOrTier}\nSummary: ${intentSummary}\nAction: Context bundle attached; automated ledger write held pending human approval.`
    : `To: ${preset.notifyChannel}\nStatus: Committed to ${preset.targetSystem}\nEntity: ${entity} | Ref: ${reference} | Value/Tier: ${valueOrTier}\nSummary: ${intentSummary}\nAction: All 3 SOP policy gates passed (${(confidence * 100).toFixed(0)}% confidence). Confirmation dispatched automatically.`;

  return {
    hashHex,
    byteLength,
    wordCount,
    entity,
    reference,
    valueOrTier,
    intentSummary,
    amountUsd,
    confidence,
    rules,
    escalated,
    escalationReason,
    routeTarget,
    draftSubject,
    draftBody,
  };
}

/* ---------- 1. Machine Stage HUD (inside data-scene-section="machine") ---------- */

export function MachineStageHud() {
  const [activeIdx, setActiveIdx] = useState<number>(0);

  const handleSelectStation = (idx: number) => {
    setActiveIdx(idx);
    setOpsStation(idx);
  };

  return (
    <div className="ops-stage-hud container-x">
      <div className="ops-stage-hud__top">
        <span className="micro-label">{STUDIO_COPY.machineEyebrow}</span>
        <p className="ops-stage-hud__caption">{STUDIO_COPY.machineSub}</p>
      </div>

      <div className="ops-stage-hud__spacer" aria-hidden="true" />

      <div
        className="ops-station-bar"
        role="tablist"
        aria-label="3D Sorting Machine Stations"
      >
        {MACHINE_STATIONS.map((st, idx) => {
          const isSelected = activeIdx === idx;
          return (
            <button
              key={st.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`ops-station-pill${isSelected ? ' is-active' : ''}`}
              onClick={() => handleSelectStation(idx)}
            >
              <div className="ops-station-pill__head">
                <span className="ops-station-pill__idx">{st.index}</span>
                <span className="ops-station-pill__dot" aria-hidden="true" />
              </div>
              <strong className="ops-station-pill__title">{st.label}</strong>
              <span className="ops-station-pill__role">{st.role}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- 2. The Automation Studio (Interactive Workbench) ---------- */

const VOLUME_OPTIONS = [50, 250, 1000] as const;

export default function AutomationStudio() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [processId, setProcessId] = useState<ProcessId>('lead-intake');
  const [payloadText, setPayloadText] = useState<string>(
    PROCESS_PRESETS['lead-intake'].samples[0].payload,
  );
  const [enabledNodes, setEnabledNodes] = useState<Record<NodeId, boolean>>({
    trigger: true,
    extract: true,
    classify: true,
    route: true,
    update: true,
    notify: true,
  });
  const [forceEscalate, setForceEscalate] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<NodeId>('classify');
  const [activeStepIdx, setActiveStepIdx] = useState<number>(5);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runCount, setRunCount] = useState<number>(2);
  const [dailyVolume, setDailyVolume] = useState<number>(250);
  const [ledgerRows, setLedgerRows] = useState<LedgerRecord[]>(
    INITIAL_LEDGER_RECORDS,
  );
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>(
    'Lead Intake workflow assembled and ready.',
  );

  const timersRef = useRef<number[]>([]);
  const recordSeqRef = useRef<number>(9040);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const preset = PROCESS_PRESETS[processId];

  const parsed = useMemo(
    () => analyzePayload(processId, payloadText, enabledNodes, forceEscalate),
    [processId, payloadText, enabledNodes, forceEscalate],
  );

  // Sync enabled flags & escalation state to the 3D WebGL scene bus
  useEffect(() => {
    setOpsStationEnabled([
      enabledNodes.trigger,
      enabledNodes.extract,
      enabledNodes.classify,
      enabledNodes.route,
      enabledNodes.update || enabledNodes.notify,
    ]);
  }, [enabledNodes]);

  useEffect(() => {
    setOpsRunState({ escalated: parsed.escalated });
  }, [parsed.escalated]);

  /* Execute a live, animated run across the 6 nodes and commit to the table */
  const triggerRun = useCallback(
    (customProcessId?: ProcessId, customPayload?: string, customForceEscalate?: boolean) => {
      clearTimers();
      const pid = customProcessId ?? processId;
      const text = customPayload ?? payloadText;
      const forced = customForceEscalate ?? forceEscalate;
      const curPreset = PROCESS_PRESETS[pid];
      const evaluation = analyzePayload(pid, text, enabledNodes, forced);

      const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      const commitFinalRecord = () => {
        const nextSeq = recordSeqRef.current++;
        const now = new Date();
        const hh = String(now.getUTCHours()).padStart(2, '0');
        const mm = String(now.getUTCMinutes()).padStart(2, '0');
        const ss = String(now.getUTCSeconds()).padStart(2, '0');

        const status: LedgerRecord['status'] = evaluation.escalated
          ? 'ESCALATED'
          : enabledNodes.update
            ? 'COMMITTED'
            : 'BYPASSED';

        const newRow: LedgerRecord = {
          id: `OPS-${nextSeq}`,
          timestamp: `${hh}:${mm}:${ss} UTC`,
          processLabel: curPreset.shortLabel,
          entity: evaluation.entity,
          reference: evaluation.reference,
          valueOrTier: evaluation.valueOrTier,
          route: evaluation.routeTarget,
          status,
          latencySec: `${curPreset.automatedSecondsPerCase.toFixed(1)}s`,
        };

        setLedgerRows((prev) => [newRow, ...prev]);
        setRunCount((c) => {
          const next = c + 1;
          setOpsRunState({
            isRunning: false,
            runProgress: 1,
            activeStation: evaluation.escalated ? 3 : 4,
            escalated: evaluation.escalated,
            completedRuns: next,
          });
          return next;
        });
        setIsRunning(false);
        setActiveStepIdx(5);
        setLiveAnnouncement(
          `Run OPS-${nextSeq} complete: ${status} via ${evaluation.routeTarget}.`,
        );
      };

      if (reducedMotion) {
        commitFinalRecord();
        return;
      }

      setIsRunning(true);
      setActiveStepIdx(0);
      setOpsRunState({
        isRunning: true,
        runProgress: 0.05,
        activeStation: 0,
        escalated: evaluation.escalated,
      });

      const stepDelays = [0, 260, 520, 800, 1080, 1340];
      stepDelays.forEach((delay, idx) => {
        const tid = window.setTimeout(() => {
          setActiveStepIdx(idx);
          const stationIdx = Math.min(4, idx);
          setOpsRunState({
            isRunning: true,
            runProgress: (idx + 0.5) / 6,
            activeStation: stationIdx,
            escalated: evaluation.escalated,
          });
        }, delay);
        timersRef.current.push(tid);
      });

      const doneTid = window.setTimeout(commitFinalRecord, 1620);
      timersRef.current.push(doneTid);
    },
    [clearTimers, enabledNodes, forceEscalate, payloadText, processId],
  );

  const handleSelectProcess = (nextId: ProcessId) => {
    const nextPreset = PROCESS_PRESETS[nextId];
    const nextPayload = nextPreset.samples[0].payload;
    setProcessId(nextId);
    setPayloadText(nextPayload);
    setForceEscalate(false);
    setOpsProcess(nextId);
    triggerRun(nextId, nextPayload, false);
  };

  const handleLoadSample = (samplePayload: string, isExceptionSample: boolean) => {
    setPayloadText(samplePayload);
    setForceEscalate(false);
    triggerRun(processId, samplePayload, isExceptionSample ? false : false);
  };

  const handleToggleNode = (nodeId: NodeId) => {
    setEnabledNodes((prev) => {
      const next = { ...prev, [nodeId]: !prev[nodeId] };
      return next;
    });
  };

  const handleSelectNodeCard = (nodeId: NodeId, idx: number) => {
    setSelectedNode(nodeId);
    setOpsStation(Math.min(4, idx));
  };

  // Cumulative time metrics
  const manualMinPerRun = preset.manualMinutesPerCase;
  const autoSecPerRun = preset.automatedSecondsPerCase;
  const totalManualMinSession = runCount * manualMinPerRun;
  const totalAutoSecSession = +(runCount * autoSecPerRun).toFixed(1);
  const annualHoursSaved = Math.round(
    ((manualMinPerRun - autoSecPerRun / 60) * dailyVolume * 260) / 60,
  );

  // Build live execution log lines for the current run
  const executionLogs = useMemo(() => {
    const lines: {
      nodeId: NodeId;
      stepNo: string;
      status: 'ok' | 'warn' | 'skip';
      cmd: string;
      output: string;
    }[] = [
      {
        nodeId: 'trigger',
        stepNo: '01',
        status: 'ok',
        cmd: `ingest_payload({ source: "${preset.triggerSource}", hash: "${parsed.hashHex}" })`,
        output: `Normalized ${parsed.byteLength} bytes (${parsed.wordCount} tokens) onto main rail.`,
      },
      {
        nodeId: 'extract',
        stepNo: '02',
        status: enabledNodes.extract ? 'ok' : 'skip',
        cmd: `extract_schema({ entity: "${parsed.entity}", ref: "${parsed.reference}" })`,
        output: enabledNodes.extract
          ? `Extracted entity="${parsed.entity}", ref="${parsed.reference}", value="${parsed.valueOrTier}" (${Math.round(parsed.confidence * 100)}% conf).`
          : 'SKIPPED — Station 02 toggled off by operator; raw text buffer passed downstream.',
      },
      {
        nodeId: 'classify',
        stepNo: '03',
        status: !enabledNodes.classify
          ? 'skip'
          : parsed.escalated
            ? 'warn'
            : 'ok',
        cmd: `evaluate_rules({ ruleset: "${processId}.sop.v4" })`,
        output: !enabledNodes.classify
          ? 'SKIPPED — Station 03 toggled off; policy threshold rules bypassed.'
          : parsed.escalated
            ? `EXCEPTION FLAGGED: ${parsed.escalationReason}`
            : 'All 3 explicit SOP policy gates passed (0 exceptions).',
      },
      {
        nodeId: 'route',
        stepNo: '04',
        status: parsed.escalated ? 'warn' : 'ok',
        cmd: `switch_track({ branch: "${parsed.escalated ? 'HUMAN_ESCALATION_SPUR' : 'AUTO_RAIL_MAIN'}" })`,
        output: `Rotary diverter locked to: ${parsed.routeTarget}.`,
      },
      {
        nodeId: 'update',
        stepNo: '05',
        status: parsed.escalated
          ? 'warn'
          : enabledNodes.update
            ? 'ok'
            : 'skip',
        cmd: `commit_record({ target: "${preset.targetSystem}" })`,
        output: parsed.escalated
          ? 'Ledger auto-commit held; escalation record logged for human sign-off.'
          : enabledNodes.update
            ? `Committed structured row to ${preset.targetSystem} table.`
            : 'SKIPPED — Station 05 (Update Record) toggled off by operator.',
      },
      {
        nodeId: 'notify',
        stepNo: '06',
        status: enabledNodes.notify ? 'ok' : 'skip',
        cmd: `dispatch_notice({ channel: "${preset.notifyChannel}" })`,
        output: enabledNodes.notify
          ? `Drafted and dispatched "${parsed.draftSubject}".`
          : 'SKIPPED — Station 06 (Notify) toggled off by operator.',
      },
    ];
    return lines;
  }, [enabledNodes, parsed, preset, processId]);

  return (
    <div className="ops-studio-wrap">
      <div
        className="ops-studio"
        data-running={isRunning || undefined}
        data-escalated={parsed.escalated || undefined}
      >
        {/* ==================== WINDOW TITLEBAR ==================== */}
        <header className="ops-studio__titlebar">
          <div className="ops-studio__lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>

          <div className="ops-studio__brand">
            <span className="ops-studio__mark" aria-hidden="true">
              <Sparkles size={13} />
            </span>
            <b>Cato Automation Studio</b>
            <span className="ops-studio__sep" aria-hidden="true">
              /
            </span>
            <span className="ops-studio__proc-name">{preset.label}</span>
          </div>

          <div
            className="ops-studio__status"
            data-tone={
              isRunning ? 'busy' : parsed.escalated ? 'warn' : 'ok'
            }
          >
            <span className="ops-studio__status-dot" aria-hidden="true" />
            <span>
              {isRunning
                ? `Running Station 0${Math.min(6, activeStepIdx + 1)}…`
                : parsed.escalated
                  ? 'Routed: Human Escalation Spur'
                  : 'Committed: Automated Rail'}
            </span>
          </div>

          <div className="ops-studio__actions">
            <button
              type="button"
              className={`ops-studio__branch-btn${forceEscalate ? ' is-forced' : ''}`}
              onClick={() => {
                const next = !forceEscalate;
                setForceEscalate(next);
                triggerRun(processId, payloadText, next);
              }}
              data-testid="ops-force-escalate"
              aria-pressed={forceEscalate}
            >
              <GitBranch size={13} aria-hidden="true" />
              <span>
                {forceEscalate ? 'Spur: Forced Escalation' : 'Spur: Auto by Rules'}
              </span>
            </button>

            <button
              type="button"
              className="ops-studio__run-btn"
              onClick={() => triggerRun()}
              data-testid="ops-run-btn"
            >
              {isRunning ? (
                <RotateCcw size={13} aria-hidden="true" />
              ) : (
                <Play size={13} aria-hidden="true" />
              )}
              <span>{isRunning ? 'Re-run Now' : 'Run Workflow'}</span>
            </button>
          </div>
        </header>

        {/* ==================== PROCESS TABS ==================== */}
        <div
          className="ops-studio__tabs"
          role="tablist"
          aria-label="Operational Processes"
        >
          {(Object.keys(PROCESS_PRESETS) as ProcessId[]).map((pid) => {
            const p = PROCESS_PRESETS[pid];
            const active = pid === processId;
            return (
              <button
                key={pid}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`ops-tab-${pid}`}
                className={`ops-studio__tab${active ? ' is-active' : ''}`}
                onClick={() => handleSelectProcess(pid)}
              >
                <span className="ops-studio__tab-cat">{p.category}</span>
                <strong className="ops-studio__tab-label">{p.shortLabel}</strong>
              </button>
            );
          })}
        </div>

        {/* ==================== STUDIO BODY (2 COLUMNS) ==================== */}
        <div className="ops-studio__body">
          {/* LEFT PANE: Payload Input + Agent Assembly & Execution Trace */}
          <div className="ops-studio__left">
            {/* Sample selector + Payload Editor */}
            <div className="ops-pane-block">
              <div className="ops-pane-block__head">
                <label
                  htmlFor={`${uid}-payload`}
                  className="ops-pane-block__title"
                >
                  <Terminal size={13} aria-hidden="true" />
                  <span>Inbound Payload ({preset.triggerSource})</span>
                </label>
                <div className="ops-sample-pills">
                  {preset.samples.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={
                        idx === 0
                          ? 'ops-sample-standard'
                          : 'ops-sample-exception'
                      }
                      className={`ops-sample-pill${
                        payloadText === s.payload ? ' is-active' : ''
                      }${s.badge === 'Escalation Case' ? ' is-exception' : ''}`}
                      onClick={() =>
                        handleLoadSample(
                          s.payload,
                          s.badge === 'Escalation Case',
                        )
                      }
                    >
                      {s.badge === 'Escalation Case' ? (
                        <AlertTriangle size={11} aria-hidden="true" />
                      ) : (
                        <CheckCircle2 size={11} aria-hidden="true" />
                      )}
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                id={`${uid}-payload`}
                data-testid="ops-payload-input"
                className="ops-payload-textarea"
                rows={4}
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                placeholder="Paste or type any operational message, ticket, booking request, or invoice..."
              />

              <div className="ops-payload-meta">
                <span>Hash: {parsed.hashHex}</span>
                <span>{parsed.byteLength} bytes</span>
                <span>{parsed.wordCount} words</span>
                <button
                  type="button"
                  className="ops-payload-meta__run"
                  onClick={() => triggerRun()}
                >
                  Parse & Run <ArrowRight size={11} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Vibe-Studio-Style Agent Architect & Live Run Trace */}
            <div className="ops-pane-block ops-trace-block">
              <div className="ops-pane-block__head">
                <span className="ops-pane-block__title">
                  <Cpu size={13} aria-hidden="true" />
                  <span>Agent Architect & Execution Trace</span>
                </span>
                <span className="ops-trace-badge">Deterministic SOP</span>
              </div>

              <div className="ops-trace-scroll" data-lenis-prevent>
                {/* Part A: Agent Graph Assembly Trace */}
                <div className="ops-trace-group">
                  <div className="ops-trace-group__label">
                    <Sparkles size={12} aria-hidden="true" />
                    <span>Workflow Assembly — {preset.label}</span>
                  </div>
                  {preset.architectTrace.map((item, i) => (
                    <div key={i} className="ops-trace-item">
                      <div className="ops-trace-item__head">
                        <span className="ops-trace-item__step">{item.step}</span>
                        <code className="ops-trace-item__tool">{item.tool}</code>
                      </div>
                      <p className="ops-trace-item__detail">{item.detail}</p>
                    </div>
                  ))}
                </div>

                {/* Part B: Live Station-by-Station Execution Log */}
                <div className="ops-trace-group">
                  <div className="ops-trace-group__label">
                    <Activity size={12} aria-hidden="true" />
                    <span>Live Payload Run Log</span>
                  </div>
                  {executionLogs.map((log, idx) => {
                    const isCurrent = isRunning && activeStepIdx === idx;
                    const isVisited = !isRunning || activeStepIdx >= idx;
                    return (
                      <div
                        key={log.nodeId}
                        className={`ops-log-row${isCurrent ? ' is-current' : ''}${
                          !isVisited ? ' is-pending' : ''
                        }`}
                        data-status={log.status}
                      >
                        <span className="ops-log-row__idx">[{log.stepNo}]</span>
                        <div className="ops-log-row__body">
                          <code className="ops-log-row__cmd">{log.cmd}</code>
                          <span className="ops-log-row__out">{log.output}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANE: Node Graph + Real Visible Work Outputs */}
          <div className="ops-studio__right">
            {/* 1. Interactive Node Graph with Branching */}
            <div className="ops-graph-panel">
              <div className="ops-graph-panel__head">
                <span className="ops-pane-block__title">
                  <GitBranch size={13} aria-hidden="true" />
                  <span>
                    Workflow Node Graph (Toggle stations or branch and re-run)
                  </span>
                </span>
                <span className="ops-graph-panel__legend">
                  3D Rail Synced · Active Branch:{' '}
                  <strong>
                    {parsed.escalated
                      ? 'Escalation Spur (Human)'
                      : 'Main Automated Rail'}
                  </strong>
                </span>
              </div>

              {/* SVG Schematic connector rail behind the node cards */}
              <div className="ops-graph-stage">
                <svg
                  className="ops-graph-svg"
                  viewBox="0 0 900 130"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {/* Main automated rail path */}
                  <path
                    d="M 40 50 L 540 50 C 600 50, 610 34, 670 34 L 860 34"
                    className={`ops-graph-edge ops-graph-edge--auto${
                      !parsed.escalated ? ' is-active' : ''
                    }`}
                  />
                  {/* Escalation spur branch path */}
                  <path
                    d="M 490 50 C 560 50, 580 102, 660 102 L 860 102"
                    className={`ops-graph-edge ops-graph-edge--spur${
                      parsed.escalated ? ' is-active' : ''
                    }`}
                  />
                </svg>

                <div className="ops-nodes-grid">
                  {WORKFLOW_NODES.map((node, idx) => {
                    const enabled = enabledNodes[node.id];
                    const isFocused = selectedNode === node.id;
                    const isStepActive = isRunning && activeStepIdx === idx;
                    const bypassedByEscalation =
                      parsed.escalated && node.id === 'update';

                    return (
                      <div
                        key={node.id}
                        className={`ops-node-card${
                          isFocused ? ' is-selected' : ''
                        }${isStepActive ? ' is-stepping' : ''}${
                          !enabled || bypassedByEscalation ? ' is-disabled' : ''
                        }`}
                        onClick={() => handleSelectNodeCard(node.id, idx)}
                      >
                        <div className="ops-node-card__top">
                          <span className="ops-node-card__code">
                            {node.stationCode}
                          </span>
                          {node.optionalToggle && (
                            <button
                              type="button"
                              data-testid={`ops-toggle-${node.id}`}
                              className={`ops-node-toggle${
                                enabled ? ' is-on' : ''
                              }`}
                              aria-pressed={enabled}
                              aria-label={`Toggle ${node.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleNode(node.id);
                              }}
                            >
                              {enabled ? 'ON' : 'OFF'}
                            </button>
                          )}
                        </div>
                        <strong className="ops-node-card__title">
                          {node.title}
                        </strong>
                        <span className="ops-node-card__sub">
                          {bypassedByEscalation
                            ? 'Held for human approval'
                            : !enabled
                              ? 'Bypassed by toggle'
                              : node.subtitle}
                        </span>
                        <code className="ops-node-card__fn">{node.toolName}</code>
                      </div>
                    );
                  })}
                </div>

                {/* Branch Banner showing the active track switch */}
                <div
                  className={`ops-branch-banner${
                    parsed.escalated ? ' is-escalated' : ' is-auto'
                  }`}
                >
                  <div className="ops-branch-banner__main">
                    {parsed.escalated ? (
                      <ShieldAlert size={15} aria-hidden="true" />
                    ) : (
                      <Zap size={15} aria-hidden="true" />
                    )}
                    <div>
                      <strong>{parsed.routeTarget}</strong>
                      <span>
                        {parsed.escalated
                          ? `Exception Triggered: ${parsed.escalationReason}. Full context attached for human decision.`
                          : preset.ruleSummary}
                      </span>
                    </div>
                  </div>
                  <span className="ops-branch-banner__badge">
                    {parsed.escalated ? 'HUMAN SPUR' : 'AUTO RAIL'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Visible Work Outputs: Extracted Schema + Explicit Rules + Drafted Notice */}
            <div className="ops-work-grid">
              {/* Extracted Schema & Explicit Rules Card */}
              <div className="ops-work-card">
                <div className="ops-work-card__head">
                  <span className="ops-pane-block__title">
                    <Cpu size={13} aria-hidden="true" />
                    <span>Parsed Fields & Explicit Rule Evaluation</span>
                  </span>
                  <span className="ops-conf-pill">
                    Confidence: {(parsed.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <dl className="ops-kv-grid" data-testid="ops-extracted-fields">
                  <div>
                    <dt>Entity / Sender</dt>
                    <dd>{parsed.entity}</dd>
                  </div>
                  <div>
                    <dt>Reference / Window</dt>
                    <dd>{parsed.reference}</dd>
                  </div>
                  <div>
                    <dt>Value / Tier</dt>
                    <dd>{parsed.valueOrTier}</dd>
                  </div>
                  <div>
                    <dt>Intent Summary</dt>
                    <dd>{parsed.intentSummary}</dd>
                  </div>
                </dl>

                <div className="ops-rules-list">
                  {parsed.rules.map((r) => (
                    <div
                      key={r.id}
                      className={`ops-rule-item${
                        r.passed ? ' is-pass' : ' is-fail'
                      }`}
                    >
                      <div className="ops-rule-item__top">
                        <strong>{r.label}</strong>
                        <span className="ops-rule-item__badge">
                          {r.passed ? 'PASS' : 'ESCALATE'}
                        </span>
                      </div>
                      <code>{r.expression}</code>
                      <span>{r.detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outbound Notification / Escalation Packet Card */}
              <div className="ops-work-card">
                <div className="ops-work-card__head">
                  <span className="ops-pane-block__title">
                    <Send size={13} aria-hidden="true" />
                    <span>
                      {parsed.escalated
                        ? 'Human Escalation Context Packet'
                        : 'Drafted Outbound Notification'}
                    </span>
                  </span>
                  <span className="ops-conf-pill">{preset.notifyChannel}</span>
                </div>

                <div
                  className="ops-notice-preview"
                  data-testid="ops-notification-preview"
                >
                  <div className="ops-notice-preview__subj">
                    {enabledNodes.notify
                      ? parsed.draftSubject
                      : '[SUPPRESSED] Station 06 (Notify) is toggled OFF'}
                  </div>
                  <pre className="ops-notice-preview__body">
                    {enabledNodes.notify
                      ? parsed.draftBody
                      : 'Enable Station 06 (Notify & Dispatch) in the node graph above to generate and dispatch outbound confirmations.'}
                  </pre>
                </div>
              </div>
            </div>

            {/* 3. Visible System-of-Record Ledger Table */}
            <div className="ops-ledger-card">
              <div className="ops-work-card__head">
                <span className="ops-pane-block__title">
                  <Database size={13} aria-hidden="true" />
                  <span>
                    Live System-of-Record Ledger ({preset.targetSystem})
                  </span>
                </span>
                <span className="ops-conf-pill">
                  {ledgerRows.length} committed rows
                </span>
              </div>

              <div className="ops-ledger-table-wrap" data-lenis-prevent>
                <table
                  className="ops-ledger-table"
                  data-testid="ops-ledger-table"
                >
                  <thead>
                    <tr>
                      <th>Record ID</th>
                      <th>Process</th>
                      <th>Counterparty / Entity</th>
                      <th>Ref / Value</th>
                      <th>Route & Destination</th>
                      <th>Status</th>
                      <th>Runtime</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((row) => (
                      <tr key={row.id}>
                        <td className="ops-td-mono">{row.id}</td>
                        <td>{row.processLabel}</td>
                        <td>
                          <strong>{row.entity}</strong>
                        </td>
                        <td>
                          {row.reference} · {row.valueOrTier}
                        </td>
                        <td>{row.route}</td>
                        <td>
                          <span
                            className={`ops-status-tag ops-status-tag--${row.status.toLowerCase()}`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="ops-td-mono">{row.latencySec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== TELEMETRY & ROI COUNTER FOOTER ==================== */}
        <footer className="ops-studio__footer">
          <div className="ops-roi-strip">
            <div className="ops-roi-metric">
              <span className="ops-roi-metric__label">
                <Clock size={12} aria-hidden="true" /> Single Case Time
              </span>
              <strong className="ops-roi-metric__val">
                {manualMinPerRun}m 00s manual{' '}
                <span className="ops-roi-arrow">→</span> {autoSecPerRun}s on
                rails
              </strong>
              <span className="ops-roi-metric__sub">
                {preset.manualBreakdown}
              </span>
            </div>

            <div className="ops-roi-metric">
              <span className="ops-roi-metric__label">
                Session Cumulative ({runCount} runs)
              </span>
              <strong
                className="ops-roi-metric__val"
                data-testid="ops-session-counter"
              >
                {totalManualMinSession} min manual{' '}
                <span className="ops-roi-arrow">vs.</span> {totalAutoSecSession}s
                automated
              </strong>
              <span className="ops-roi-metric__sub">
                Every run above appends to the ledger and updates this counter
              </span>
            </div>

            <div className="ops-roi-metric ops-roi-metric--volume">
              <div className="ops-roi-vol-head">
                <span className="ops-roi-metric__label">
                  Annualized Hours Recovered
                </span>
                <div
                  className="ops-vol-pills"
                  role="group"
                  aria-label="Daily case volume"
                >
                  {VOLUME_OPTIONS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`ops-vol-pill${
                        dailyVolume === v ? ' is-active' : ''
                      }`}
                      onClick={() => setDailyVolume(v)}
                    >
                      {v}/day
                    </button>
                  ))}
                </div>
              </div>
              <strong className="ops-roi-metric__val ops-roi-metric__val--accent">
                {annualHoursSaved.toLocaleString()} hrs / yr returned to team
              </strong>
              <span className="ops-roi-metric__sub">
                At {dailyVolume} cases/day × 260 operating days
              </span>
            </div>
          </div>

          <p className="ops-assumptions-note">{STUDIO_COPY.assumptionsNote}</p>
        </footer>
      </div>

      <p className="ops-sr-only" aria-live="polite">
        {liveAnnouncement}
      </p>
    </div>
  );
}
