# Cato journey code review

codeQualityStatus: WATCH
recommendation: APPROVE

## Scope and evidence

Compared `output/playwright/cato-journeys/AiAgentSystemsScene.before.txt` with `components/webgl/scenes/capabilities/children/AiAgentSystemsScene.tsx`. Read the adjacent native run/home/play/release lifecycle in `components/webgl/kit/cato/timmy-core.js`, frame projection in `components/webgl/kit/cato/CatoBody.tsx`, and navigation in `components/webgl/kit/cato/bus.ts`. No other dirty files were reviewed. No source was edited or tests run. Parent owns real UI validation; this is static code approval only. No executor success claim or UI artifact was relied on.

The current-session ULW status command returned ULW_LOOP_PLAN_MISSING, so this report uses the fallback evidence path.

## Findings

- CRITICAL: none.
- HIGH: none.
- MEDIUM: none established in the scoped change.
- LOW: the scene remains an oversized module under the programming/remove-ai-slops size criterion, and the added choreography expands it. Existing scene ownership and the user's narrow transition-only scope argue against an incidental broad refactor in this task.

## Correctness observations

Each curve shares exact endpoints with the adjacent stop positions. Reverse navigation decreases the same curve parameter, preserving boundary position; direct navigation still traverses adjacent segments. Camera offsets return to the established stop composition as the envelope reaches zero. Scene frame priority -1 plus matrix updates lets CatoBody consume the current camera/group transform. Tool, beat, voice, robot geometry and material paths are untouched. Reduced motion snaps the scene to its destination and bypasses travel.

Run uses the native stateful move, then hands off to native home rather than attempting to scrub locomotion. Native run traces a local circle, so the visual result of combining that local motion with a horizontal wrapper path still needs UI assessment. Reverse movement retains the existing endpoint hold for k above TOUCH. These are visual acceptance questions, not demonstrated code failures.

## Skill perspective check

Consulted `omo:remove-ai-slops` and `omo:programming` before maintainability judgment. No tests were added in the scoped diff, so no deletion-only, tautological, prose-pinning, or implementation-constant tests exist here. No new production parsing, normalization, speculative abstraction, or untyped escape hatch was introduced. Material assertions follow the existing concrete JSX material ownership pattern. The module-size guideline is the only noted perspective violation; it predates this change and was not promoted to a behavior blocker.

## Blockers

None established by static review. Approval does not certify live rendering, phone framing, reduced-motion toggling mid-run, or actual tool/voice behavior; parent UI QA remains required before completion claims.
