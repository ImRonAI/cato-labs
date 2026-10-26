type NativeResponse = Record<string, unknown>;

export async function verifyNativeResponse(
  id: string,
  model?: string,
  key = '',
  signal?: AbortSignal,
  requireCompleted = false,
): Promise<{ snapshot: NativeResponse; error?: never } | { snapshot?: never; error: Response }> {
  try {
    const upstream = await fetch(`https://api.perplexity.ai/v1/agent/${id}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: 'no-store', signal,
    });
    if (!upstream.ok) {
      const status = upstream.status === 404 ? 404 : upstream.status === 429 ? 429 : 502;
      const retryAfter = upstream.headers.get('retry-after');
      await upstream.body?.cancel();
      return { error: Response.json({ error: { message: status === 404 ? 'The agent response was not found.' : 'Could not verify the agent response. Please retry.' } }, {
        status, headers: { 'Cache-Control': 'no-store', ...(retryAfter ? { 'Retry-After': retryAfter } : {}) },
      }) };
    }
    const snapshot: unknown = await upstream.json();
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
      || !('id' in snapshot) || snapshot.id !== id
      || (model && (!('model' in snapshot) || snapshot.model !== model))) {
      return { error: Response.json({ error: { message: 'This response is not available through this endpoint.' } }, { status: 404, headers: { 'Cache-Control': 'no-store' } }) };
    }
    if (requireCompleted && (!('status' in snapshot) || snapshot.status !== 'completed')) {
      return { error: Response.json({ error: { message: 'Only a completed response can continue a conversation.' } }, { status: 400, headers: { 'Cache-Control': 'no-store' } }) };
    }
    return { snapshot: snapshot as NativeResponse };
  } catch {
    return { error: Response.json({ error: { message: 'Could not verify the agent response. Please retry.' } }, { status: 502, headers: { 'Cache-Control': 'no-store' } }) };
  }
}
