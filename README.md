# model-router

Eine Mod für Claude Code, die einfache Aufgaben automatisch an günstigere Modelle weiterleitet. Ein klar beschriebenes Jira-Ticket läuft so auf Sonnet statt auf Opus, eine Architekturfrage bleibt auf Opus.

## Voraussetzungen

- Claude Code mit Unterstützung für Hooks-Module (Mods). Diese API ist im Early Access und kann sich ändern. Entwickelt und getestet wurde die Mod mit Claude Code 2.1.304.
- Zugriff auf die Modelle, die in den Optionen stehen. Nutzt dein Konto oder dein Anbieter andere Modell-IDs, trägst du sie dort ein (siehe unten).

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

Ablauf bei der Installation:

1. Claude Code fragt `Add marketplace?` und nennt `github:Julianspk/model-router`. Mit `y` bestätigen.
2. Einen Gültigkeitsbereich wählen, zum Beispiel den für deinen Benutzer.
3. Die Optionen werden abgefragt. Die Standardwerte passen für die meisten Fälle.
4. Danach steht `Installed model-router. Plugin is now active.` Die Mod ist sofort aktiv.

Das Repository ist privat. Installieren können es nur Personen, die es auf GitHub lesen dürfen und deren Rechner schon eine Git-Anmeldung für github.com hat (SSH-Key, oder `gh auth login` und danach `gh auth setup-git`).

Prüfen, ob die Mod läuft: `/router` eingeben. Die Antwort ist `Modell-Router ist an.`

## Benutzung

Du musst nichts tun. Schreib deine Prompts wie bisher, der Router entscheidet pro Prompt, welches Modell arbeitet. Welches Modell gewählt wurde, steht in der Statuszeile als `Router: <Modell>`.

Beispiele für die zu erwartende Einstufung:

| Prompt | Einstufung |
| --- | --- |
| `Setze PROJ-42 auf In Progress und kommentiere es` | Sonnet |
| `Führe git status aus` | Haiku |
| `Wir haben eine Race Condition in der Queue, finde die Ursache` | Opus |

### Befehle

| Eingabe | Wirkung |
| --- | --- |
| `/router` | zeigt, ob der Router an oder aus ist |
| `/router off` | schaltet den Router aus, bis du ihn wieder anschaltest |
| `/router on` | schaltet den Router wieder an |

Der Zustand wird gespeichert und gilt auch in späteren Sessions. Ohne gespeicherten Wert ist der Router an. Schreib den Befehl klein: `/router`.

### Ein Modell erzwingen

Mit `!haiku`, `!sonnet` oder `!opus` am Anfang eines Prompts bestimmst du das Modell selbst:

```
!opus Setze PROJ-42 um und prüf die Auswirkungen auf die Auth-Logik
```

- Das Präfix wird vor dem Absenden entfernt, das Modell sieht nur den Rest.
- Es gilt für genau diesen einen Turn. Der nächste Prompt wird wieder automatisch eingestuft.
- Es geht auch nach oben: `!opus` läuft auf Opus, auch wenn die Session auf Sonnet steht.
- Es funktioniert auch bei ausgeschaltetem Router.
- In der Statuszeile steht dann `Router: <Modell> (erzwungen)`.

### Dauerhaft ausschalten oder deaktivieren

- Pausieren: `/router off`. Die Mod bleibt installiert, greift aber nicht mehr ein.
- Ganz abschalten: `claude plugin disable model-router`.

## Wie der Router entscheidet

1. Bei jedem neuen Prompt und jedem Start eines Subagenten stuft Haiku die Aufgabe als `haiku`, `sonnet` oder `opus` ein.
   - `haiku`: mechanische Aufgaben ohne Abwägung, etwa eine kurze Faktenfrage, umbenennen, formatieren oder einfache Befehle.
   - `sonnet`: klar umrissene Standardarbeit, etwa Jira-Tickets lesen, anlegen oder umsetzen, eine Funktion schreiben, Tests ergänzen, Doku oder ein Bugfix mit bekannter Ursache.
   - `opus`: Architektur, Debugging mit unbekannter Ursache, Refactoring über viele Dateien, Sicherheit und unklare Anforderungen.
   - Im Zweifel wählt der Klassifikator die stärkere Stufe. Er sieht auch das Ende der letzten Antwort, damit kurze Zustimmungen wie „ja, mach das“ zur richtigen Aufgabe gezählt werden.
2. Alle Modellanfragen dieses Turns laufen auf dem gewählten Modell, auch die Schritte mit Tool-Aufrufen.
3. Automatisch wird nur herabgestuft. Das Modell, das du für die Session gewählt hast, ist die Obergrenze.
4. Antwortet der Klassifikator nicht innerhalb von 8 Sekunden, bleibt das Modell unverändert.

## Optionen

Die Optionen werden bei der Installation abgefragt und stehen danach in den Einstellungen unter `pluginConfigs`.

| Option | Standard | Bedeutung |
| --- | --- | --- |
| `classifierModel` | `haiku` | Modell, das jede Aufgabe einstuft |
| `haikuModel` | `claude-haiku-5-5` | Modell-ID für die Stufe `haiku` |
| `sonnetModel` | `claude-sonnet-5-5` | Modell-ID für die Stufe `sonnet` |
| `opusModel` | `claude-opus-5-5` | Modell-ID für die Stufe `opus`, nur für `!opus` |

## Grenzen

- Wechselt das Modell mitten in einer langen Session, liest das neue Modell den ganzen Verlauf ohne Prompt-Cache. Bei sehr langen Sessions kann das die Ersparnis auffressen.
- Jeder Prompt kostet einen kurzen Haiku-Aufruf, etwa eine Sekunde Wartezeit.
- Ein Agent-Aufruf, der ausdrücklich ein stärkeres Modell verlangt, kann heruntergestuft werden.
- Die Einstufung ist eine Heuristik und liegt manchmal daneben. Dafür gibt es `!opus`, `!sonnet` und `!haiku`.

## Entwicklung

Im Ordner der Mod, mit Claude Code 2.1.304:

```
claude plugin validate .
claude plugin test .
```

Die Logik steht in `hooks/register.ts`, die Tests in `tests/router.test.ts`.
