/**
 * chatRuntime.ts — the launcher bridge inside each generated site.
 *
 * The builder designs the concierge LAUNCHER (`[data-vibe-chat]` with a
 * `[data-vibe-chat-toggle]` button); the conversation itself renders in the
 * host page (ConciergeChat) with AI Elements, which can't run inside the
 * sandboxed iframe. This script is the bridge, injected once the build
 * completes:
 *
 *   iframe → host  { vibe: 'toggle' }                          launcher clicked
 *   iframe → host  { vibe: 'links', links: [{label, href}] }  the page's #sections, for the concierge's map
 *   host → iframe  { vibe: 'open' | 'closed' }                 mirrors .is-open on [data-vibe-chat]
 *   host → iframe  { vibe: 'goto', href: '#section' }         scrolls to a section (LinkButton in a card)
 *
 * Older builds that also shipped a panel get it hidden — the host owns the conversation.
 * Written without backticks or "</script>" on purpose: it ships inside a <script> tag.
 */
export const CHAT_RUNTIME_JS =
  '<script>(function(){' +
  'var root=document.querySelector("[data-vibe-chat]");' +
  'var toggle=root&&root.querySelector("[data-vibe-chat-toggle]");' +
  'var post=function(m){try{parent.postMessage(m,"*");}catch(e){}};' +
  'var panel=root&&root.querySelector("[data-vibe-chat-panel]");' +
  'if(panel){panel.hidden=true;panel.style.display="none";}' +
  'if(toggle){toggle.addEventListener("click",function(e){e.preventDefault();post({vibe:"toggle"});});}' +
  'var out=[];var as=document.querySelectorAll("a[href^=\\"#\\"]");' +
  'for(var i=0;i<as.length&&out.length<12;i++){var t=(as[i].textContent||"").trim();' +
  'if(t&&as[i].getAttribute("href").length>1)out.push({label:t.slice(0,40),href:as[i].getAttribute("href")});}' +
  'post({vibe:"links",links:out,launcher:!!toggle});' +
  'window.addEventListener("message",function(e){var d=e.data||{};' +
  'if(d.vibe==="open"&&root)root.classList.add("is-open");' +
  'if(d.vibe==="closed"&&root)root.classList.remove("is-open");' +
  'if(d.vibe==="goto"&&typeof d.href==="string"&&d.href.charAt(0)==="#"){' +
  'var el=document.getElementById(d.href.slice(1));if(el)el.scrollIntoView({behavior:"smooth"});}' +
  '});' +
  '})();</script>';
