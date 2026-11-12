import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BRIDGE_PORT = '8787';
const DEFAULT_BRIDGE_URL = `http://127.0.0.1:${DEFAULT_BRIDGE_PORT}`;

interface BridgeState {
  proc: ChildProcess | null;
  booting: Promise<string> | null;
}

const globalBridge = globalThis as unknown as { __catoMistralBridge?: BridgeState };

function state(): BridgeState {
  if (!globalBridge.__catoMistralBridge) {
    globalBridge.__catoMistralBridge = { proc: null, booting: null };
  }
  return globalBridge.__catoMistralBridge;
}

export function mistralBridgeBaseUrl(): string {
  return (process.env.MISTRAL_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/+$/, '');
}

async function isBridgeHealthy(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Ensures the Python Mistral Agents SDK bridge (`agent/concierge/bridge_server.py`)
 * is reachable, auto-spawning uvicorn from `agent/concierge/.venv` locally if needed.
 */
export async function ensureMistralBridge(): Promise<string> {
  const baseUrl = mistralBridgeBaseUrl();
  if (await isBridgeHealthy(baseUrl)) {
    return baseUrl;
  }

  // Only auto-spawn when targeting local loopback bridge
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(baseUrl)) {
    return baseUrl;
  }

  const st = state();
  if (st.booting) {
    return st.booting;
  }

  st.booting = (async () => {
    try {
      if (await isBridgeHealthy(baseUrl)) return baseUrl;

      const conciergeDir = path.join(process.cwd(), 'agent', 'concierge');
      const uvicornBin = path.join(conciergeDir, '.venv', 'bin', 'uvicorn');
      if (!fs.existsSync(uvicornBin)) {
        return baseUrl;
      }

      const parsedUrl = new URL(baseUrl);
      const port = parsedUrl.port || DEFAULT_BRIDGE_PORT;

      const child = spawn(
        uvicornBin,
        ['bridge_server:app', '--host', '127.0.0.1', '--port', port],
        {
          cwd: conciergeDir,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
          },
          stdio: 'ignore',
          detached: true,
        }
      );
      child.unref();
      st.proc = child;

      for (;;) {
        if (await isBridgeHealthy(baseUrl)) {
          return baseUrl;
        }
        if (child.exitCode !== null) {
          return baseUrl;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    } finally {
      st.booting = null;
    }
  })();

  return st.booting;
}
