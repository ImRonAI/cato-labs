# Native vibe coding replacement

Scope: replace the live vibe coding agent and its canvas, retaining the surrounding website. This workspace has no Git repository, so the final evidence binds to source hashes rather than a commit SHA.

## Documentation before source review

Fetched the live https://docs.perplexity.ai/llms.txt, then https://docs.perplexity.ai/api-reference/agent-post.md. Queried Context7 `/llmstxt/perplexity_ai_llms_txt`. Verified model listing at https://docs.perplexity.ai/docs/agent-api/models.md and output capacity at https://platform.claude.com/docs/en/models/overview.

The request uses native POST /v1/agent, anthropic/claude-opus-5-5, max_output_tokens 128000, max_steps 100, background/stream/store true, all six hosted tools, builtin office and complete inline frontend-design/frontend-development skills. Perplexity owns the tool loop. The application forwards native events and renders output; it does not execute a custom model/tool loop.

Native features: sequence-number resume, retrieval, cancellation, input_file attachments, sandbox file creation and share_file, metadata listing and byte downloads. The API has no documented hosted subagent primitive. Each UI builder identifies a distinct real response; concurrent briefs create independent native requests.

## Baseline findings

- Existing live route batched HTML by completed sections and stripped scripts and external assets.
- Existing canvas replaced iframe srcDoc repeatedly, assigned one response to five fictional agents and randomized cursor positions.
- Existing failure handler switched to a prerecorded StreamSimulator. Real browser submission reproduced the fallback message and generic Your product brand output.
- Model, output budget and step budget were already set correctly; they were retained and pinned in the replacement configuration.

## Verification recorded so far

1. Playwright submitted a real Cato Counter website brief. Provider response `resp_8f70b3fd-3838-4923-8196-6101e24025b9` reached completed at sequence 555. No mock responses or intercepted routes.
2. Browser message observations recorded 42 canvas paints. The first body paint contained 14 elements at 3151 characters; later paint contained 44 elements at 5308 characters. These occurred with provider status in_progress. DOM targets included div, main#top and li.
3. Actual generated iframe controls: counter value 0, clicked Increase -> 1, clicked Reset -> 0.
4. Native sandbox created and shared index.html. UI Refresh files exposed the native download link. Clicking downloaded output/playwright/generated-index.html, 5313 bytes, complete HTML with the functioning counter.
5. npm run build passed compilation, type validation, all 54 static pages and trace collection. Build trace includes .agents/skills/frontend-design/SKILL.md.
6. Started production server on 127.0.0.1:3217. Browser reload restored completed build from session storage; generated Increase button again changed counter to 1.

Artifacts: output/playwright/native-build-complete.png, output/playwright/generated-index.html. Initial development console had an existing missing favicon.ico; switching dev to production briefly produced an expected disconnected hot-update request. Production interactive verification reported no errors, with existing stylesheet preload warnings.

## Production acceptance

Native Office/source run `resp_5f4e5d66-c7be-48d0-b13a-aed0e740ba3b` completed. A real source attachment was sent as native input_text, frontend-design and office/pdf were loaded, the native sandbox wrote and shared index.html and guide.pdf. UI downloads are `output/playwright/revised-index.html` (6588 bytes) and `output/playwright/guide.pdf` (3271 bytes, genuine PDF 1.4, one page). While running, a reload restored disconnected state; Reconnect resumed the same response with the saved sequence. Production streaming screenshot `output/playwright/production-streaming-cursor.png` shows the real Builder 4 cursor outlining the generated footer. Browser metrics recorded six paints after reconnect while in_progress, from 5709 to 6537 characters.

Live provider discovery changed the upload implementation: Opus rejected HTML and TXT input_file documents. UTF-8 source is therefore supplied through native input_text; PDF uses native input_file. The actual provider errors remained visible and did not activate a fake fallback. PDF input was subsequently accepted by `resp_001f8466-91c5-45c3-a610-220f5d3c43c0`.

Final fixes: cancellation may close native SSE without a terminal event, so the client retrieves durable status and briefly polls cancellation. It does not run an agent/tool loop. Duplicate iframe render messages now skip reconciliation, preserving interacted DOM state; root HTML attributes are synchronized. During QA a click while the outer page was still scrolling landed on sticky navigation. Final interaction checks wait for stable preview geometry, then use real trusted clicks.

| Scenario | Actual UI action / observation | Verdict | Artifact |
| --- | --- | --- | --- |
| Final production build | npm run build: compilation, types, 54 pages, tracing; inline design skill included in route trace | PASS | .omo/evidence/final-build.log |
| Generated controls and root attributes | Completed native website: Increase 0 to 1 to 2, Reset to 0, light to dark, html lang=en | PASS | .omo/evidence/final-controls.log; output/playwright/final-controls.png |
| PDF input and cancellation | Attached generated guide.pdf, submitted a real brief, clicked Stop Builder 2; native response reached cancelled with no UI error | PASS | .omo/evidence/final-cancellation.log; output/playwright/native-cancelled.png |
| Native continuation | Revise website carried previous_response_id, produced distinct completed response resp_a17776d7-3eb0-4e06-9024-ed04a29e8808, Increase changed count to 1, native index.html downloaded | PASS | .omo/evidence/final-revision-submit.log; .omo/evidence/final-revision.log; output/playwright/revision-index.html |
| Mobile layout | 390px viewport, document scrollWidth390; generated iframe width282, scrollWidth282 | PASS | .omo/evidence/final-revision.log; output/playwright/final-mobile.png |
| Office output/source upload | Native skills and sandbox created and shared HTML plus one-page PDF, downloaded through UI links | PASS | output/playwright/revised-index.html; output/playwright/guide.pdf; output/playwright/production-streaming-cursor.png |
| Background reconnect | Reload during Builder4 native run, reconnect same response ID and saved sequence, subsequently completed | PASS | Production run record above; output/playwright/production-streaming-cursor.png |

All six hosted tools are configured. The actual acceptance briefs exercised skills, sandbox writes/shares, source and PDF inputs, lifecycle, and downloads; they did not force unrelated finance/people/image searches. Office PDF was exercised; DOCX/PPTX/XLSX are enabled through the native Office family but were not individually generated. Native API exposes no hosted subagent primitive: each displayed builder corresponds to one real response with its own canvas/cursor.

The unrelated preexisting AURELLE promotional animation elsewhere on the page remains outside the live builder. The live builder has no StreamSimulator import, scripted response, random cursor, tool executor, model fallback, or client credential.

Final stream recapture after the renderer fixes: response `resp_5d73bc0d-bd73-44fd-8274-838e80396401` was created, reloaded at sequence1, restored as disconnected, and resumed using the same response ID. It completed at sequence386 and shared index.html. The observer recorded 29 paints, including successive developing divs at1959 and2096 characters and later section#how, li, section#today and footer, all while in_progress. Evidence: .omo/evidence/final-background-reconnect.log, .omo/evidence/final-stream-cursor.log, .omo/evidence/final-stream-completed.log, output/playwright/final-stream-cursor.png. The screenshot shows the named Builder3 cursor tracing the actual developing div.

The final visual pass caught two integration defects: bootstrap body white overrode valid generated :root backgrounds, and the surrounding page Reveal observer required18% intersection of a studio that can exceed the viewport by many screens after session restoration. The first was removed; cursor labels also switch sides at the canvas edge. The live studio was removed from the entrance-animation wrapper, so restored multi-build sessions remain visible and interactive. The ordinary static page headings retain their animations.

Final restored-session regression PASS: production reload restored all six builds with no hidden Reveal ancestors. Real Start click advanced25:00 to24:59; Pause reported24:59; Reset restored25:00. Generated root background remained rgb(19,34,74). Evidence: .omo/evidence/final-timer-controls.log and output/playwright/final-timer-controls.png. The final build passed again after removing only the outer Reveal wrapper; native transport/canvas stream behavior is unchanged from the 29-paint run above.

Final mobile regression on this tree also passed: viewport/document390, iframe282/scroll282, actual Increase changed0 to1. Evidence: .omo/evidence/final-mobile.log and output/playwright/final-mobile.png.

Manual QA lane: PASS on the source tree bound by .omo/evidence/final-source.sha256 (no Git repository). Independent gate reviewer: APPROVE, no blocking findings. Report: .omo/evidence/vibe-native-gate-review.md. Both lanes refer to the same verified source hashes. Overall review: PASSED. Local production preview remains on http://127.0.0.1:3217/capabilities/digital-products#vibe; no deployment was performed.
