// Builds lib/mcp-app/sandbox.html from the owner's TelnyxMCP MCP Apps sandbox
// (packages/app/src/host/sandbox.ts + sandbox.html), exactly as TelnyxMCP's
// build.mjs does: esbuild bundle inlined into the official sandbox HTML, with the
// allowed-referrer pattern for this site.
// usage: node scripts/build-mcp-sandbox.mjs [path/to/TelnyxMCP/packages/app]
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const APP = process.argv[2] ?? '/Users/tims-stuff/TelnyxMCP/packages/app';
const HOST_DIR = join(APP, 'src', 'host');
const { build } = createRequire(join(APP, 'package.json'))('esbuild');

const ALLOWED_REFERRER = String.raw`^https?://`;
const SANDBOX_SCRIPT_TAG = '<script type="module" src="/src/sandbox.ts"></script>';

const bundle = await build({
  entryPoints: [join(HOST_DIR, 'sandbox.ts')],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  write: false,
  define: { __OUBLIAI_ALLOWED_REFERRER__: JSON.stringify(ALLOWED_REFERRER) },
});
const html = await readFile(join(HOST_DIR, 'sandbox.html'), 'utf8');
if (!html.includes(SANDBOX_SCRIPT_TAG)) throw new Error('sandbox.html no longer has the expected script tag');
const out = html.replace(SANDBOX_SCRIPT_TAG, () =>
  '<script type="module">' + bundle.outputFiles[0].text.replace(/<\/script/gi, String.raw`<\/script`) + '</script>');
await writeFile(new URL('../lib/mcp-app/sandbox.html', import.meta.url), out, 'utf8');
console.log('wrote lib/mcp-app/sandbox.html', out.length);
