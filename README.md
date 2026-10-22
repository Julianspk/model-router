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

Prüfen, ob die Mod läuft: `/router` eingeben. Die Antwort ist `Modell-Router ist an.`

## Benutzung

Du musst nichts tun. Schreib deine Prompts wie bisher, der Router entscheidet pro Arbeitsschritt, welches Modell arbeitet. Welches Modell gewählt wurde, steht in der Statuszeile als `Router: <Modell>`.

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

1. Im Hauptgespräch stuft Haiku vor jedem einzelnen Modellaufruf den nächsten Arbeitsschritt ein, nicht erst den ganzen Prompt. Ein Auftrag wie „bearbeite das Ticket“ läuft so Schritt für Schritt: Lesen auf Sonnet oder Haiku, Auswerten und Entscheiden auf Opus, Recherche wieder auf Sonnet, ein kurzer Text auf Haiku. Haiku sieht dafür die Aufgabe und, was der letzte Schritt aufgerufen und zurückbekommen hat. Einen Subagenten stuft Haiku einmal beim Start ein, weil sein Prompt die ganze Aufgabe nennt. Die Stufen:
   - `haiku`: mechanische Aufgaben ohne Abwägung, etwa eine kurze Faktenfrage, umbenennen, formatieren oder einfache Befehle.
   - `sonnet`: klar umrissene Standardarbeit, etwa Jira-Tickets lesen, anlegen oder umsetzen, eine Funktion schreiben, Tests ergänzen, Doku oder ein Bugfix mit bekannter Ursache.
   - `opus`: Architektur, Debugging mit unbekannter Ursache, Refactoring über viele Dateien, Sicherheit und unklare Anforderungen.
   - Im Zweifel wählt der Klassifikator die stärkere Stufe. Er sieht auch das Ende der letzten Antwort, damit kurze Zustimmungen wie „ja, mach das“ zur richtigen Aufgabe gezählt werden.
2. Ein Schritt läuft auf der gewählten Stufe. Im Hauptgespräch kann sie sich im selben Turn ändern, bei einem Subagenten oder mit `!opus` bleibt sie für alle Schritte gleich.
3. Läuft ein Turn auf Opus, behält Opus Planung und Entscheidungen, bekommt aber einen Hinweis im Systemprompt: reine Lesearbeit wie ein Jira-Ticket lesen, Code durchsuchen oder Logs sichten gibt es an einen Subagenten ab. Der Subagent wird wie jeder andere eingestuft und läuft meist auf Sonnet oder Haiku. Opus bekommt nur seine Zusammenfassung.
4. Automatisch wird nur herabgestuft. Das Modell, das du für die Session gewählt hast, ist die Obergrenze.
5. Antwortet der Klassifikator nicht (Subagent: 8 Sekunden, Schritt: 4 Sekunden), bleibt die Stufe des Schritts davor, beim ersten Schritt das Modell der Session.

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
- Jeder Schritt im Hauptgespräch kostet einen kurzen Haiku-Aufruf, etwa eine Sekunde Wartezeit. Ein Auftrag mit 20 Tool-Aufrufen wartet also gut 20 Sekunden mehr.
- Jeder Modellwechsel mitten im Turn lässt das neue Modell den ganzen bisherigen Verlauf ohne Prompt-Cache lesen. Je länger der Verlauf, desto eher frisst das die Ersparnis auf; bei wechselnden Stufen in kurzer Folge kann es teurer werden als ein durchgehendes Opus.
- Der Verlauf enthält Denkblöcke des vorherigen Modells. Ob jedes Modell sie nach einem Wechsel anstandslos annimmt, ist noch nicht an einer langen Session erprobt; bei Fehlern nach einem Wechsel hilft `/router off`.
- Ein Subagent bringt seinen eigenen Systemprompt mit. Bei einem einzelnen kurzen Ticket ist die Ersparnis klein, bei viel Lesestoff groß, weil Opus nur die Zusammenfassung liest und mitschleppt.
- Ein Agent-Aufruf, der ausdrücklich ein stärkeres Modell verlangt, kann heruntergestuft werden.
- Die Einstufung ist eine Heuristik und liegt manchmal daneben. Dafür gibt es `!opus`, `!sonnet` und `!haiku`.

## Entwicklung

Im Ordner der Mod, mit Claude Code 2.1.304:

```
claude plugin validate .
claude plugin test .
```

Die Logik steht in `hooks/register.ts`, die Tests in `tests/router.test.ts`.
