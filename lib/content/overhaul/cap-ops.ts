/**
 * Overhaul copy & deterministic process definitions for /capabilities/operations-automation (lane: cap-ops).
 * All strings, sample payloads, explicit rules, and labelled time-model assumptions live here.
 */

export type ProcessId =
  | 'lead-intake'
  | 'invoice-approval'
  | 'appointment-scheduling'
  | 'support-triage';

export type NodeId =
  | 'trigger'
  | 'extract'
  | 'classify'
  | 'route'
  | 'update'
  | 'notify';

export interface WorkflowNodeSpec {
  id: NodeId;
  index: string;
  stationCode: string;
  title: string;
  subtitle: string;
  toolName: string;
  defaultEnabled: boolean;
  optionalToggle: boolean;
}

export interface ProcessSample {
  id: string;
  label: string;
  badge: 'Standard Rail' | 'Escalation Case';
  payload: string;
}

export interface ProcessPreset {
  id: ProcessId;
  label: string;
  shortLabel: string;
  category: string;
  triggerSource: string;
  targetSystem: string;
  notifyChannel: string;
  manualMinutesPerCase: number;
  automatedSecondsPerCase: number;
  manualBreakdown: string;
  ruleSummary: string;
  escalationPolicy: string;
  architectTrace: {
    step: string;
    tool: string;
    detail: string;
  }[];
  samples: ProcessSample[];
}

export interface LedgerRecord {
  id: string;
  timestamp: string;
  processLabel: string;
  entity: string;
  reference: string;
  valueOrTier: string;
  route: string;
  status: 'COMMITTED' | 'ESCALATED' | 'BYPASSED';
  latencySec: string;
}

export const WORKFLOW_NODES: readonly WorkflowNodeSpec[] = [
  {
    id: 'trigger',
    index: '01',
    stationCode: 'ST-01 · INFEED',
    title: 'Trigger & Ingest',
    subtitle: 'Webhook & inbox listener',
    toolName: 'ingest_payload()',
    defaultEnabled: true,
    optionalToggle: false,
  },
  {
    id: 'extract',
    index: '02',
    stationCode: 'ST-02 · OPTICAL SCAN',
    title: 'Extract Fields',
    subtitle: 'Deterministic schema parser',
    toolName: 'extract_schema()',
    defaultEnabled: true,
    optionalToggle: true,
  },
  {
    id: 'classify',
    index: '03',
    stationCode: 'ST-03 · LOGIC GATE',
    title: 'Classify & Score',
    subtitle: 'Explicit SOP policy rules',
    toolName: 'evaluate_rules()',
    defaultEnabled: true,
    optionalToggle: true,
  },
  {
    id: 'route',
    index: '04',
    stationCode: 'ST-04 · DIVERTER',
    title: 'Route or Escalate',
    subtitle: 'Auto rail vs. human spur',
    toolName: 'switch_track()',
    defaultEnabled: true,
    optionalToggle: false,
  },
  {
    id: 'update',
    index: '05',
    stationCode: 'ST-05 · LEDGER PRESS',
    title: 'Update Record',
    subtitle: 'System-of-record commit',
    toolName: 'commit_record()',
    defaultEnabled: true,
    optionalToggle: true,
  },
  {
    id: 'notify',
    index: '06',
    stationCode: 'ST-06 · DISPATCH MAST',
    title: 'Notify & Dispatch',
    subtitle: 'Draft & send confirmation',
    toolName: 'dispatch_notice()',
    defaultEnabled: true,
    optionalToggle: true,
  },
] as const;

export const MACHINE_STATIONS = [
  {
    index: '01',
    id: 'trigger' as NodeId,
    label: 'Infeed Singulator',
    role: 'Raw payloads enter the glass hopper and align to the rail.',
  },
  {
    index: '02',
    id: 'extract' as NodeId,
    label: 'Optical Scan Gantry',
    role: 'Laser curtain parses entities, amounts, dates and reference IDs.',
  },
  {
    index: '03',
    id: 'classify' as NodeId,
    label: 'SOP Logic Chamber',
    role: 'Explicit policy gates score risk and verify threshold compliance.',
  },
  {
    index: '04',
    id: 'route' as NodeId,
    label: 'Rotary Track Diverter',
    role: 'Standard work stays on the high-speed rail; exceptions switch to the human spur.',
  },
  {
    index: '05',
    id: 'update' as NodeId,
    label: 'Ledger Press & Mast',
    role: 'Commits the structured row to the system of record and dispatches confirmation.',
  },
] as const;

export const PROCESS_PRESETS: Record<ProcessId, ProcessPreset> = {
  'lead-intake': {
    id: 'lead-intake',
    label: 'Lead Intake & Qualification',
    shortLabel: 'Lead Intake',
    category: 'Revenue Operations',
    triggerSource: 'Inbound Webform / Sales Inbox',
    targetSystem: 'HubSpot / Salesforce CRM',
    notifyChannel: '#rev-ops-enterprise + Rep Calendar',
    manualMinutesPerCase: 14,
    automatedSecondsPerCase: 1.8,
    manualBreakdown: '4m inbox read + 5m firmographic lookup & CRM entry + 3m territory routing + 2m rep handoff note',
    ruleSummary: 'Auto-route to Enterprise Pod when seat_count >= 100 or budget >= $25k; escalate to Legal/Exec Desk if air-gapped, custom addendum, or procurement waiver is requested.',
    escalationPolicy: 'Escalate to Deal Desk & Solutions Architect with full thread context when non-standard compliance or custom terms appear.',
    architectTrace: [
      {
        step: 'Inspecting process SOP',
        tool: 'read_sop("revops/inbound-lead-routing.v4")',
        detail: 'Mapped 4 manual handoffs between inbox, enrichment, CRM opportunity creation, and AE assignment.',
      },
      {
        step: 'Compiling field extractor',
        tool: 'compile_schema({ fields: ["contact", "company", "seats", "budget", "timeline", "compliance_flags"] })',
        detail: 'Bound deterministic patterns for email headers, seat counts, ARR figures, and regulated-deployment keywords.',
      },
      {
        step: 'Wiring classification & diverter gates',
        tool: 'bind_gate({ auto: "standard_enterprise_rail", exception: "deal_desk_escalation" })',
        detail: 'Configured rotary switch: clean commercial briefs commit directly to CRM; custom legal/air-gapped briefs divert to Deal Desk.',
      },
    ],
    samples: [
      {
        id: 'lead-standard',
        label: 'Standard Enterprise Lead',
        badge: 'Standard Rail',
        payload:
          'From: Elena Rostova <elena@meridianhealth.io> | Company: Meridian Health (420 seats) | Need: Replace legacy helpdesk + manual intake across 4 regional clinics before Q3. Budget: $85,000 ARR. Timeline: Target kickoff May 12.',
      },
      {
        id: 'lead-exception',
        label: 'Exception: Air-Gapped / Custom Legal',
        badge: 'Escalation Case',
        payload:
          'From: Marcus Vance <mvance@apexdefense.gov> | Company: Apex Federal Systems (1,800 seats) | Need: On-premise air-gapped deployment with custom FedRAMP addendum and liability indemnity waiver. Budget: TBD (procurement review).',
      },
    ],
  },

  'invoice-approval': {
    id: 'invoice-approval',
    label: 'Invoice 3-Way Match & Approval',
    shortLabel: 'Invoice Approval',
    category: 'Finance Operations',
    triggerSource: 'AP Inbox / EDI Webhook',
    targetSystem: 'NetSuite / ERP General Ledger',
    notifyChannel: '#ap-ledger-commits + Vendor Portal',
    manualMinutesPerCase: 18,
    automatedSecondsPerCase: 2.1,
    manualBreakdown: '5m PDF line-item read + 6m PO lookup & variance check + 4m GL cost-center coding + 3m approval routing',
    ruleSummary: 'Auto-approve and post to ERP when PO number is present, amount <= $15,000, and variance == 0%; escalate to Controller when amount > $15,000, rush surcharge, or overage is detected.',
    escalationPolicy: 'Hold ledger post and route to Finance Controller queue with variance diff when invoice exceeds policy cap or PO tolerance.',
    architectTrace: [
      {
        step: 'Inspecting AP control matrix',
        tool: 'read_sop("finops/ap-three-way-match.v3")',
        detail: 'Identified $15,000 auto-approval ceiling, PO reference requirement, and zero-tolerance surcharge rule.',
      },
      {
        step: 'Compiling invoice parser',
        tool: 'compile_schema({ fields: ["vendor", "invoice_id", "po_number", "amount_usd", "cost_center", "variance_flags"] })',
        detail: 'Attached currency normalizer, PO cross-reference extractor, and line-item surcharge detector.',
      },
      {
        step: 'Wiring ERP ledger press & controller spur',
        tool: 'bind_gate({ auto: "netsuite_gl_post", exception: "controller_signoff_queue" })',
        detail: 'Matched invoices stamp directly into the GL table; policy exceptions divert to Controller review with full audit trail.',
      },
    ],
    samples: [
      {
        id: 'inv-standard',
        label: 'Matched PO Invoice ($4,280)',
        badge: 'Standard Rail',
        payload:
          'Vendor: Northstar Cloud Infrastructure | Invoice: INV-2026-0842 | PO: PO-8841 | Amount: $4,280.00 | Line items: Dedicated GPU cluster (April) + managed backup | Terms: Net 30 | Cost center: ENG-INFRA',
      },
      {
        id: 'inv-exception',
        label: 'Exception: Over Cap + Overage ($38,500)',
        badge: 'Escalation Case',
        payload:
          'Vendor: Sterling Advisory Group | Invoice: INV-2026-0915 | PO: PO-8790 | Amount: $38,500.00 | Line items: Unscheduled Q2 retainer overage + rush surcharge (+24% vs PO) | Terms: Due on receipt',
      },
    ],
  },

  'appointment-scheduling': {
    id: 'appointment-scheduling',
    label: 'Appointment Intake & Slot Dispatch',
    shortLabel: 'Scheduling',
    category: 'Service & Clinical Ops',
    triggerSource: 'Booking Portal / Inbound SMS & Email',
    targetSystem: 'Calendar & Practice Management DB',
    notifyChannel: 'Client Calendar Invite + Ops Desk',
    manualMinutesPerCase: 11,
    automatedSecondsPerCase: 1.5,
    manualBreakdown: '3m request parsing + 4m multi-calendar availability check + 2m room/resource lock + 2m confirmation email',
    ruleSummary: 'Auto-lock slot and send calendar invite when standard session window is requested and no legal prerequisite is pending; escalate to Scheduling Coordinator for urgent next-day onsite or unsigned BAA.',
    escalationPolicy: 'Route to Senior Coordinator when multi-director onsite coordination, <24h rush turnaround, or legal prerequisite is flagged.',
    architectTrace: [
      {
        step: 'Inspecting scheduling rules',
        tool: 'read_sop("ops/calendar-dispatch-rules.v2")',
        detail: 'Loaded provider availability windows, room capacity constraints, and compliance prerequisites.',
      },
      {
        step: 'Compiling booking entity parser',
        tool: 'compile_schema({ fields: ["requester", "service_type", "requested_window", "location", "special_constraints"] })',
        detail: 'Configured timezone-aware slot extraction and prerequisite flag detection.',
      },
      {
        step: 'Wiring calendar commit & coordinator spur',
        tool: 'bind_gate({ auto: "calendar_slot_lock", exception: "coordinator_concierge_spur" })',
        detail: 'Standard bookings lock the calendar table immediately; multi-party urgent requests route to Coordinator with pre-held options.',
      },
    ],
    samples: [
      {
        id: 'sched-standard',
        label: 'Standard Executive Diagnostic',
        badge: 'Standard Rail',
        payload:
          'Client: David Chen <d.chen@velo-capital.com> | Service: Executive Strategy Diagnostic (60 min) | Requested: Thursday 14:00 EST or Friday 10:30 EST | Location: NYC SoHo Office | Notes: Bringing VP of Operations.',
      },
      {
        id: 'sched-exception',
        label: 'Exception: Urgent Onsite + BAA Prerequisite',
        badge: 'Escalation Case',
        payload:
          'Client: Dr. Priya Nair <pnair@pacificoncology.org> | Service: Multi-site Clinical Workflow Audit (Half-day onsite) | Requested: Tomorrow 08:00 PST (Urgent) | Notes: Requires 3 clinical directors + HIPAA BAA countersignature prior to visit.',
      },
    ],
  },

  'support-triage': {
    id: 'support-triage',
    label: 'Support Triage & SLA Routing',
    shortLabel: 'Support Triage',
    category: 'Customer Support Ops',
    triggerSource: 'Helpdesk Queue / API Telemetry',
    targetSystem: 'Unified Helpdesk & Incident Ledger',
    notifyChannel: 'Customer Thread + #support-triage',
    manualMinutesPerCase: 16,
    automatedSecondsPerCase: 1.6,
    manualBreakdown: '4m ticket classification + 5m log/account lookup + 4m runbook matching + 3m response drafting or escalation',
    ruleSummary: 'Auto-classify, attach diagnostic runbook, and send verified remediation for known Tier-1/API configuration issues; escalate immediately to On-Call Incident Commander for P1 outage or stalled production queues.',
    escalationPolicy: 'Page On-Call Incident Commander and open bridge immediately when P1, production stall, or Enterprise SLA breach risk is detected.',
    architectTrace: [
      {
        step: 'Inspecting helpdesk SLA matrix',
        tool: 'read_sop("support/unified-triage-sla.v5")',
        detail: 'Consolidated 5 regional inboxes into a single deterministic severity and runbook classifier.',
      },
      {
        step: 'Compiling ticket telemetry extractor',
        tool: 'compile_schema({ fields: ["ticket_id", "account_tier", "component", "error_signature", "severity_level"] })',
        detail: 'Linked HTTP/webhook signature patterns and P1 production outage detectors.',
      },
      {
        step: 'Wiring runbook resolver & P1 incident spur',
        tool: 'bind_gate({ auto: "tier1_verified_resolution", exception: "p1_incident_bridge" })',
        detail: 'Known signature mismatches receive instant verified remediation; P1 production stalls page the Incident Commander with full diagnostics.',
      },
    ],
    samples: [
      {
        id: 'sup-standard',
        label: 'Standard Tier-1 Webhook Issue',
        badge: 'Standard Rail',
        payload:
          'Ticket #4921 | From: ops@lumina-retail.co (Pro Plan) | Subject: Webhook signature verification failing on /v2/orders/fulfilled | Error: HTTP 401 HMAC mismatch after rotating staging secret at 09:14 UTC.',
      },
      {
        id: 'sup-exception',
        label: 'Exception: P1 Production Queue Outage',
        badge: 'Escalation Case',
        payload:
          'Ticket #4928 | From: cto@harborbank.com (Enterprise SLA) | Subject: URGENT P1 — Production checkout queue stalled for 18 minutes, 412 pending transactions stuck in PENDING_SYNC state. Requesting immediate incident bridge.',
      },
    ],
  },
};

export const INITIAL_LEDGER_RECORDS: LedgerRecord[] = [
  {
    id: 'OPS-9038',
    timestamp: '09:41:12 UTC',
    processLabel: 'Support Triage',
    entity: 'lumina-retail.co',
    reference: 'Ticket #4921',
    valueOrTier: 'Pro Plan · Tier-1',
    route: 'Auto-Rail → Verified HMAC Runbook',
    status: 'COMMITTED',
    latencySec: '1.6s',
  },
  {
    id: 'OPS-9039',
    timestamp: '09:41:48 UTC',
    processLabel: 'Invoice Approval',
    reference: 'INV-2026-0842 / PO-8841',
    entity: 'Northstar Cloud Infrastructure',
    valueOrTier: '$4,280.00',
    route: 'Auto-Rail → NetSuite GL (ENG-INFRA)',
    status: 'COMMITTED',
    latencySec: '2.1s',
  },
];

export const STUDIO_COPY = {
  machineEyebrow: 'The Rail Architecture — Five Stations',
  machineTitle: 'Every handoff specified. Every exception routed.',
  machineSub:
    'Above: the glass sorting and dispatch line. Raw inbound work enters at the left hopper, passes under optical extraction and SOP logic gates, switches tracks at the rotary diverter, and commits to the ledger.',
  eyebrow: 'Interactive Workbench — The Automation Studio',
  title: 'Watch a process move onto rails.',
  lede:
    'Pick a real operational workflow — or paste your own message — and watch the Cato agent assemble the node graph, parse the payload by explicit rules, route standard work down the automated rail, divert exceptions to a human, and commit the record.',
  assumptionsNote:
    'Illustrative model — assumptions: Manual baseline sums human inbox triage, field copy-paste across 3 tools, SOP/policy lookup, CRM/ERP record entry, and reply drafting (11–18 min/case by workflow). Automated time sums webhook ingest, deterministic rule evaluation, API record commit, and outbound notification dispatch (1.5–2.1 s/case).',
};
