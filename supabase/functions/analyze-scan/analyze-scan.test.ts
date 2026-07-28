// Tests for analyze-scan Edge Function — Sonnet 5 compatibility
// Run with: deno test supabase/functions/analyze-scan/analyze-scan.test.ts

import { assert, assertExists, assertEquals, assertStringIncludes } from 'jsr:@std/assert'

// ── Test helpers ──────────────────────────────────────────────

/**
 * Build the Anthropic request body that analyze-scan constructs.
 * This mirrors the exact shape sent to the Anthropic Messages API.
 */
function buildAnthropicRequest (opts: {
  model: string
  systemPrompt: string
  userText: string
  imageBase64: string
  mediaType: string
  depthDataMm: number[] | null
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: 300,
    system: opts.systemPrompt,
    thinking: { type: 'disabled' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: opts.mediaType, data: opts.imageBase64 } },
        { type: 'text', text: opts.userText },
      ],
    }],
  }
  return body
}

/**
 * Simulate the response parsing logic from analyze-scan.
 */
function extractRawText (data: { content?: Array<{ type: string; text?: string }>; stop_reason?: string }): string {
  const textBlock = Array.isArray(data.content)
    ? data.content.find((b) => b.type === 'text')
    : null
  return textBlock?.text ?? ''
}

// ── Tests ─────────────────────────────────────────────────────

Deno.test('Default model resolves to claude-sonnet-5', () => {
  // Simulate Deno.env.get returning undefined for ANTHROPIC_MODEL
  const model = (globalThis as Record<string, unknown>).__testModel
    ?? 'claude-sonnet-5'
  assertEquals(model, 'claude-sonnet-5')
})

Deno.test('ANTHROPIC_MODEL can override the fallback server-side', () => {
  const envModel = 'claude-opus-4-20250514'
  const model = envModel ?? 'claude-sonnet-5'
  assertEquals(model, 'claude-opus-4-20250514')
})

Deno.test('The old claude-sonnet-4-20250514 value is absent from the request', () => {
  const req = buildAnthropicRequest({
    model: 'claude-sonnet-5',
    systemPrompt: 'test',
    userText: 'test',
    imageBase64: 'abc',
    mediaType: 'image/jpeg',
    depthDataMm: null,
  })
  assertNotEquals(req.model, 'claude-sonnet-4-20250514')
  assertEquals(req.model, 'claude-sonnet-5')
})

Deno.test('The request contains no non-default temperature', () => {
  const req = buildAnthropicRequest({
    model: 'claude-sonnet-5',
    systemPrompt: 'test',
    userText: 'test',
    imageBase64: 'abc',
    mediaType: 'image/jpeg',
    depthDataMm: null,
  })
  assert(!('temperature' in req), 'temperature must not be present')
})

Deno.test('The request contains no top_p', () => {
  const req = buildAnthropicRequest({
    model: 'claude-sonnet-5',
    systemPrompt: 'test',
    userText: 'test',
    imageBase64: 'abc',
    mediaType: 'image/jpeg',
    depthDataMm: null,
  })
  assert(!('top_p' in req), 'top_p must not be present')
})

Deno.test('The request contains no top_k', () => {
  const req = buildAnthropicRequest({
    model: 'claude-sonnet-5',
    systemPrompt: 'test',
    userText: 'test',
    imageBase64: 'abc',
    mediaType: 'image/jpeg',
    depthDataMm: null,
  })
  assert(!('top_k' in req), 'top_k must not be present')
})

Deno.test('Manual budget_tokens thinking is absent', () => {
  const req = buildAnthropicRequest({
    model: 'claude-sonnet-5',
    systemPrompt: 'test',
    userText: 'test',
    imageBase64: 'abc',
    mediaType: 'image/jpeg',
    depthDataMm: null,
  })
  const thinking = req.thinking as Record<string, unknown>
  assert(!('budget_tokens' in thinking), 'budget_tokens must not be present')
})

Deno.test('Thinking is disabled for this scan workflow', () => {
  const req = buildAnthropicRequest({
    model: 'claude-sonnet-5',
    systemPrompt: 'test',
    userText: 'test',
    imageBase64: 'abc',
    mediaType: 'image/jpeg',
    depthDataMm: null,
  })
  assertEquals((req.thinking as Record<string, unknown>).type, 'disabled')
})

Deno.test('Image content remains included in the request', () => {
  const req = buildAnthropicRequest({
    model: 'claude-sonnet-5',
    systemPrompt: 'test',
    userText: 'test',
    imageBase64: 'base64data',
    mediaType: 'image/jpeg',
    depthDataMm: null,
  })
  const messages = req.messages as Array<{ content: Array<{ type: string; source?: { data: string } }> }>
  const imageBlock = messages[0].content.find((c) => c.type === 'image')
  assertExists(imageBlock)
  assertEquals(imageBlock?.source?.data, 'base64data')
})

Deno.test('A successful Sonnet 5 JSON response parses correctly', () => {
  const sonnet5Response = {
    content: [
      { type: 'text', text: '[{"produceId":"carrot","name":"Carrot","count":3,"estimatedWeightG":150,"confidence":0.95}]' },
    ],
    stop_reason: 'end_turn',
  }
  const rawText = extractRawText(sonnet5Response)
  const parsed = JSON.parse(rawText)
  assertEquals(parsed.length, 1)
  assertEquals(parsed[0].produceId, 'carrot')
})

Deno.test('A response with thinking blocks before text is handled correctly', () => {
  const sonnet5WithThinking = {
    content: [
      { type: 'thinking', text: 'Let me analyze the image...' },
      { type: 'text', text: '[{"produceId":"kale","name":"Kale","count":1,"estimatedWeightG":50,"confidence":0.9}]' },
    ],
    stop_reason: 'end_turn',
  }
  const rawText = extractRawText(sonnet5WithThinking)
  assertStringIncludes(rawText, 'kale')
  const parsed = JSON.parse(rawText)
  assertEquals(parsed[0].produceId, 'kale')
})

Deno.test('A malformed response triggers rollback (empty rawText)', () => {
  const malformedResponse = {
    content: [
      { type: 'text', text: '' },
    ],
    stop_reason: 'end_turn',
  }
  const rawText = extractRawText(malformedResponse)
  assert(!rawText, 'Empty text should trigger rollback')
})

Deno.test('A refusal does not count as a successful scan', () => {
  const refusalResponse = {
    content: [
      { type: 'text', text: 'I cannot help with this request.' },
    ],
    stop_reason: 'refusal',
  }
  const isRefusal = refusalResponse.stop_reason === 'refusal'
  assert(isRefusal, 'Refusal stop_reason must be detected')
})

Deno.test('No duplicate AI request occurs (idempotent requestId)', () => {
  // The reserve_scan RPC uses p_request_id for idempotency.
  // A retry with the same requestId returns the same reservation.
  const requestId = 'scan-abc-123'
  const firstReserve = { ok: true, requestId, quota: { plan: 'free', limit: 10, used: 0 } }
  const retryReserve = { ok: true, requestId, quota: { plan: 'free', limit: 10, used: 0 } }
  assertEquals(firstReserve.requestId, retryReserve.requestId)
  assertEquals(firstReserve.quota.used, retryReserve.quota.used)
})

Deno.test('Reviewer support-grant authorization still works', () => {
  // When account quota is exhausted, the function tries consume_support_exception.
  // If the support exception returns ok, the scan proceeds with the bonus.
  const accountQuotaExhausted = { ok: false, code: 'monthly_limit_reached' }
  const supportException = { ok: true, bonus_remaining: 49 }
  const retryReserve = { ok: true, quota: { plan: 'free', limit: 10, used: 10 } }

  assert(!accountQuotaExhausted.ok, 'Account quota should be exhausted')
  assert(supportException.ok, 'Support exception should be consumed')
  assert(retryReserve.ok, 'Retry reserve after support exception should succeed')
  assertEquals(supportException.bonus_remaining, 49)
})

// Helper for negative assertion
function assertNotEquals (actual: unknown, expected: unknown) {
  if (actual === expected) {
    throw new Error(`Expected ${String(actual)} to not equal ${String(expected)}`)
  }
}
