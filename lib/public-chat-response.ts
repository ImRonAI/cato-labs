type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined;
}

const publicErrors: Record<string, string> = {
  rate_limit_exceeded: 'Chat is busy. Please wait before trying again.',
  insufficient_quota: 'Chat is temporarily unavailable. Please try again later.',
  invalid_request_error: 'The Agent API could not accept this chat request.',
  server_error: 'The Agent API could not finish the reply. Please try again.',
  max_output_tokens: 'The reply reached its output limit before completing.',
  content_filter: 'The Agent API could not complete this reply.',
};

function publicError(value: unknown) {
  const code = object(value)?.code;
  const recognized = typeof code === 'string' && Object.hasOwn(publicErrors, code);
  return {
    code: recognized ? code : 'agent_error',
    message: recognized ? publicErrors[code] : 'The Agent API could not complete the reply. Please try again.',
  };
}

export function publicChatSnapshot(value: unknown): JsonObject {
  const response = object(value);
  if (!response) throw new Error('Invalid agent response.');
  const result: JsonObject = {};
  for (const field of ['id', 'object', 'model', 'status']) {
    if (typeof response[field] === 'string') result[field] = response[field];
  }
  if (typeof response.created_at === 'number') result.created_at = response.created_at;
  if (response.error) result.error = publicError(response.error);
  return result;
}

const lifecycleEvents = new Set([
  'response.created', 'response.queued', 'response.in_progress', 'response.completed',
  'response.failed', 'response.incomplete', 'response.cancelled',
]);

function publicChatEvent(value: unknown): JsonObject | undefined {
  const event = object(value);
  if (!event || typeof event.type !== 'string') throw new Error('Invalid agent event.');
  if (!lifecycleEvents.has(event.type) && event.type !== 'response.output_text.delta' && event.type !== 'error') return;
  const result: JsonObject = { type: event.type };
  if (typeof event.sequence_number === 'number') result.sequence_number = event.sequence_number;
  if (event.type === 'response.output_text.delta') {
    if (typeof event.delta !== 'string') throw new Error('Invalid agent text event.');
    result.delta = event.delta;
    if (typeof event.item_id === 'string') result.item_id = event.item_id;
    for (const field of ['output_index', 'content_index']) {
      if (typeof event[field] === 'number') result[field] = event[field];
    }
  } else {
    if (event.response) result.response = publicChatSnapshot(event.response);
    if (event.error || event.type === 'error') result.error = publicError(event.error);
  }
  return result;
}

export async function forwardPublicChat(upstream: Response): Promise<Response> {
  const headers = new Headers({ 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' });
  const retryAfter = upstream.headers.get('retry-after');
  if (retryAfter) headers.set('Retry-After', retryAfter);
  if (!upstream.ok) {
    await upstream.body?.cancel();
    return Response.json({ error: { message: upstream.status === 429 ? 'Chat is busy. Please wait before trying again.' : 'The Agent API could not accept this chat request. Please try again.' } }, { status: upstream.status, headers });
  }
  if (!upstream.headers.get('content-type')?.includes('text/event-stream')) {
    return Response.json(publicChatSnapshot(await upstream.json()), { status: upstream.status, headers });
  }
  if (!upstream.body) throw new Error('The agent response did not include a stream.');
  headers.set('Content-Type', 'text/event-stream');
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const consume = (block: string, controller: TransformStreamDefaultController<Uint8Array>) => {
    const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) {
      if (block.startsWith(':')) controller.enqueue(encoder.encode(': keep-alive\n\n'));
      return;
    }
    if (data === '[DONE]') { controller.enqueue(encoder.encode('data: [DONE]\n\n')); return; }
    const event = publicChatEvent(JSON.parse(data));
    if (event) controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
  };
  const project = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      let separator: RegExpExecArray | null;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        consume(buffer.slice(0, separator.index), controller);
        buffer = buffer.slice(separator.index + separator[0].length);
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer, controller);
    },
  });
  return new Response(upstream.body.pipeThrough(project), { status: upstream.status, headers });
}
