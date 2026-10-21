# model-router

Eine Mod für Claude Code, die einfache Aufgaben automatisch an günstigere Modelle weiterleitet. Ein klar beschriebenes Jira-Ticket läuft so auf Sonnet statt auf Opus.

## Installation

Im Prompt einer Terminal-Session:

```
/plugin install model-router --marketplace Julianspk/model-router
```

Aus einer Shell:

```
claude plugin install model-router --marketplace Julianspk/model-router
```

In der Desktop-App, wo `/plugin` nicht läuft: auf + neben dem Prompt-Feld klicken, dann Plugins, Add marketplace mit `Julianspk/model-router`, dann Add plugin.

Das Repository ist privat. Installieren können es nur Personen, die es auf GitHub lesen dürfen und deren Rechner schon eine Git-Anmeldung für github.com hat (SSH-Key, oder `gh auth login` und danach `gh auth setup-git`).

## Funktionsweise

1. Bei jedem neuen Prompt und jedem Subagent-Start stuft Haiku die Aufgabe als `haiku`, `sonnet` oder `opus` ein.
2. Alle Modellanfragen dieses Turns laufen auf dem gewählten Modell. Automatisch wird nur herabgestuft: das Modell der Session ist die Obergrenze.
3. Antwortet der Klassifikator nicht innerhalb von 8 Sekunden, bleibt das Modell unverändert.

Die Statuszeile zeigt das gewählte Modell als `Router: <Modell>`.

## Bedienung

| Eingabe | Wirkung |
| --- | --- |
| `/router` | zeigt, ob der Router an oder aus ist |
| `/router off` / `/router on` | schaltet den Router aus oder an, der Zustand bleibt über Sessions gespeichert |
| `!haiku`, `!sonnet`, `!opus` am Anfang eines Prompts | erzwingt das Modell für diesen einen Turn, auch nach oben. Das Präfix wird entfernt. |

## Optionen

| Option | Standard |
| --- | --- |
| `classifierModel` | `haiku` |
| `haikuModel` | `claude-haiku-5-5` |
| `sonnetModel` | `claude-sonnet-5-5` |
| `opusModel` | `claude-opus-5-5` |

## Grenzen

- Wechselt das Modell mitten in einer langen Session, liest das neue Modell den ganzen Verlauf ohne Prompt-Cache.
- Jeder Prompt kostet einen kurzen Haiku-Aufruf, etwa eine Sekunde Wartezeit.
- Ein Agent-Aufruf, der ausdrücklich ein stärkeres Modell verlangt, kann heruntergestuft werden.
