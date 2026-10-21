import type { EngineInterface, Register } from 'claude-code'

// Stufen von schwach nach stark; ein unbekanntes Modell (Opus, Fable, ...) gilt als staerkste
const TIERS = ['haiku', 'sonnet', 'opus'] as const
type Tier = (typeof TIERS)[number]

export const rank = (model: string): number => {
  const i = TIERS.findIndex(t => model.toLowerCase().includes(t))
  return i === -1 ? TIERS.length : i
}

const RUBRIC = `Du verteilst Aufgaben an das guenstigste Claude-Modell, das sie zuverlaessig schafft.
Antworte mit genau einem Wort: haiku, sonnet oder opus.

haiku: mechanisch, keine Abwaegung. Kurze Faktenfrage, etwas nachschlagen oder auflisten, umbenennen, formatieren, Tippfehler, einfache Befehle ausfuehren (git status, Tests starten), Kurzes zusammenfassen.
sonnet: klar umrissene Standardarbeit. Jira-/Ticket-Eintraege lesen, anlegen, kommentieren, verschieben oder umsetzen, wenn sie klar beschrieben sind; eine Funktion oder Komponente schreiben oder aendern; Tests ergaenzen; Bugfix mit bekannter Ursache; Doku, Commit-Messages, PR-Beschreibungen; Code-Recherche.
opus: echte Unsicherheit oder Tragweite. Architektur, Konzepte, Debugging mit unbekannter Ursache, Refactoring ueber viele Dateien, Sicherheit, Performance, Nebenlaeufigkeit, mehrdeutige Anforderungen, Planung groesserer Features.

Ist die Aufgabe nur eine Zustimmung oder Rueckfrage ("ja", "mach das"), stufe die Arbeit ein, auf die sie sich bezieht.
Im Zweifel die staerkere Stufe.`

// Opus behaelt die Fuehrung, gibt aber reine Lesearbeit an Subagenten ab; die stuft der Router guenstiger ein
const DELEGATE = `Modell-Router: Du laeufst auf dem staerksten Modell und behaeltst Planung, Abwaegung und Entscheidungen.
Reine Lesearbeit fuehrst du nicht selbst aus, sondern gibst sie an einen Subagenten (Agent-Tool) ab: ein Jira-Ticket, eine Confluence-Seite oder ein Dokument lesen, Code und Dateien durchsuchen, Logs sichten. Der Router setzt solche Subagenten automatisch auf ein guenstigeres Modell.
Bitte den Subagenten um eine knappe Zusammenfassung mit allem, was du fuer deine Entscheidung brauchst. Einzelne kurze Befehle wie git status fuehrst du selbst aus.`

// Fragt das Klassifikator-Modell nach der Stufe; undefined heisst: nicht umleiten
export const classify = async (
  $: EngineInterface,
  model: string,
  task: string,
  previous: string,
): Promise<Tier | undefined> => {
  const prompt = previous
    ? `Letzte Antwort des Assistenten (Ende):\n${previous.slice(-1500)}\n\nNeue Aufgabe:\n${task}`
    : task
  const r = await $.model.complete({
    model,
    system: RUBRIC,
    prompt: prompt.slice(0, 6000),
    maxTokens: 10,
    effort: 'low',
    timeoutMs: 8000,
  })
  if (!r.isAnswered) return undefined
  return r.text.toLowerCase().match(/haiku|sonnet|opus/)?.[0] as Tier | undefined
}

export const register: Register = (on, options) => {
  const models: Record<Tier, string> = {
    haiku: String(options.haikuModel),
    sonnet: String(options.sonnetModel),
    opus: String(options.opusModel),
  }
  // ponytail: Modulvariablen, ein Hot-Reload mitten im Turn verliert nur diese eine Einstufung
  const routes = new Map<string, { tier: Tier; isForced: boolean }>()
  let forced: Tier | undefined
  let lastAnswer = ''

  // "!opus ..." am Anfang des Prompts erzwingt das Modell fuer diesen Turn, der Praefix wird entfernt
  on('prompt.submit', ($, e, next) => {
    const m = e.command || e.isMeta ? null : e.text.match(/^\s*!(haiku|sonnet|opus)\b\s*/i)
    if (!m) return next(e)
    forced = m[1]!.toLowerCase() as Tier
    return next({ ...e, text: e.text.slice(m[0].length) })
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'router',
      description: 'Modell-Router: Status zeigen, mit "on" oder "off" schalten',
      argumentHint: '[on|off]',
    })
    return next(e)
  })

  // Nur Anfragen an Opus (oder staerker), die Subagenten starten koennen, bekommen den Hinweis
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (rank(e.model) < TIERS.indexOf('opus') || !e.tools.includes('Agent')) return r
    if ((await $.store.get('disabled')) === true) return r
    return { sections: [...r.sections, { id: 'model-router:delegate', text: DELEGATE, scope: 'session' as const }] }
  })

  on('command.run', { command: 'router' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'on' || arg === 'off') await $.store.set('disabled', arg === 'off')
    const isOff = (await $.store.get('disabled')) === true
    if (isOff) $.ui.status(undefined)
    return { text: `Modell-Router ist ${isOff ? 'aus' : 'an'}.` }
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined && forced) {
      routes.set(e.turnId, { tier: forced, isForced: true })
      forced = undefined
    } else if (e.text.trim() !== '' && (await $.store.get('disabled')) !== true) {
      // Nur der Hauptloop bekommt Kontext, ein Subagent-Prompt steht fuer sich
      const tier = await classify($, String(options.classifierModel), e.text, e.agentId ? '' : lastAnswer)
      if (tier) routes.set(e.turnId, { tier, isForced: false })
    }
    return next(e)
  })

  // Automatisch wird nur herabgestuft, ein erzwungenes Modell gilt auch nach oben
  on('turn.step', async function* ($, e, next) {
    const route = routes.get(e.turnId)
    const isApplied = route && (route.isForced || TIERS.indexOf(route.tier) < rank(e.model))
    const model = isApplied ? models[route.tier] : e.model
    if (e.agentId === undefined && e.index === 0) {
      $.ui.status(`Router: ${model}${route?.isForced ? ' (erzwungen)' : ''}`)
    }
    return yield* next({ ...e, model })
  })

  on('turn.complete', ($, e, next) => {
    routes.delete(e.turnId)
    if (e.agentId === undefined) lastAnswer = e.answer
    return next(e)
  })
}
