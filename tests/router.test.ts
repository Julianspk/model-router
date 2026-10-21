import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const USAGE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// Der Klassifikator antwortet mit `tier`; zurueck kommt eine Liste der Modelle, die gesendet wurden
const engine = (on: On, tier: string, store: Record<string, unknown> = {}) => {
  const sent: string[] = []
  mock.store(on, store)
  on('model.complete', () => ({ value: { isAnswered: true as const, text: tier, usage: USAGE } }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_, e) {
    sent.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  return sent
}

const step = async ($: Engine, turnId: string, model: string) => {
  for await (const _ of $.turn.step({ turnId, index: 0, model, messageCount: 1 }));
}

test('ein Jira-Ticket laeuft auf Sonnet statt Opus', async ($, on) => {
  const sent = engine(on, 'sonnet')
  await $.turn.start({ turnId: 't1', text: 'Setze PROJ-42 auf In Progress und kommentiere es' })
  await step($, 't1', 'claude-opus-5-5')
  expect(sent).toEqual(['claude-sonnet-5-5'])
})

test('nie hochstufen: Haiku-Session bleibt bei Haiku', async ($, on) => {
  const sent = engine(on, 'opus')
  await $.turn.start({ turnId: 't2', text: 'Entwirf eine neue Architektur' })
  await step($, 't2', 'claude-haiku-5-5')
  expect(sent).toEqual(['claude-haiku-5-5'])
})

test('Fortsetzungs-Turn ohne Text bleibt unveraendert', async ($, on) => {
  const sent = engine(on, 'haiku')
  await $.turn.start({ turnId: 't3', text: '' })
  await step($, 't3', 'claude-opus-5-5')
  expect(sent).toEqual(['claude-opus-5-5'])
})

test('!opus erzwingt Opus auch in einer Sonnet-Session und entfernt den Praefix', async ($, on) => {
  const sent = engine(on, 'haiku')
  let seen = ''
  on('prompt.submit', (_, e) => ((seen = e.text), { text: e.text }))
  await $.prompt.submit({ text: '!opus Bau das Ticket um', wait: false, origin: { kind: 'composer' } })
  await $.turn.start({ turnId: 't5', text: seen })
  await step($, 't5', 'claude-sonnet-5-5')
  await $.turn.start({ turnId: 't6', text: 'naechste Aufgabe' })
  await step($, 't6', 'claude-sonnet-5-5')
  expect(seen).toBe('Bau das Ticket um')
  expect(sent).toEqual(['claude-opus-5-5', 'claude-haiku-5-5'])
})

test('nach /router off bleibt das Modell unveraendert', async ($, on) => {
  const sent = engine(on, 'haiku', { disabled: true })
  await $.turn.start({ turnId: 't4', text: 'git status' })
  await step($, 't4', 'claude-opus-5-5')
  expect(sent).toEqual(['claude-opus-5-5'])
})
