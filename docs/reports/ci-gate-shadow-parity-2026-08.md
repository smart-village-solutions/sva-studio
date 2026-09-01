# CI-Gate-Shadow-Parität 2026-08

## Status zum 1. September 2026

- Abgenommene repräsentative PR-Stichprobe: `20/20`
- Zusätzlich ausgewertete PR-Paritätsartefakte: 43, davon 41 unmittelbar
  vergleichbare Heads ohne Scope- oder Ergebnisdrift
- Exakter PR-Paritätslauf mit verlängerter Sammler-Deadline:
  [Run 33504704837](https://github.com/smart-village-solutions/sva-studio/actions/runs/33504704837), grün
- Exakter Main-Paritätslauf:
  [Run 33506869717](https://github.com/smart-village-solutions/sva-studio/actions/runs/33506869717), grün
- Cutover-Voraussetzungen: erfüllt; der atomare Cutover entfernt
  Alt-Orchestrierung und reine Paritätslogik im selben Merge
- Aktives Ruleset `11600196`: unverändert sieben Required-Kontexte `Lint`,
  `Unit`, `Types`, `Complexity`, `PR Integration`, `File Placement`, `Coverage`
- Releasepfad `Build` → Dev → Staging → Production: unverändert

## Ergebnis der PR-Parität

Die 20-Run-Abnahmestichprobe enthält normale affected Läufe, globale
Full-Fallbacks und Docs-only-No-ops. Für jeden Lauf wurden die versionierte
Base-/Head-SHA-Scope-Evidenz und die terminalen Gate-Ergebnisse aus den
GitHub-Artefakten ausgewertet. Alle 20 Läufe zeigten identische Scope-Pläne und
identische terminale Entscheidungen. Es gab keine ungeklärte
Scope-Unterabdeckung und keine fachliche Ergebnisdrift.

Über das Abnahmefenster hinaus wurden 43 PR-Paritätsartefakte geprüft. Zwei
auffällige Läufe zählen nicht als fachliche Paritätsabweichung:

- [Run 33470327331](https://github.com/smart-village-solutions/sva-studio/actions/runs/33470327331)
  scheiterte fail-closed bereits bei der Scope-Ermittlung, weil der geänderte
  Lockfile-Stand mit `--frozen-lockfile` nicht installierbar war. Es entstand
  damit bewusst kein scheinbar erfolgreicher Unter-Scope.
- [Run 33470293249](https://github.com/smart-village-solutions/sva-studio/actions/runs/33470293249)
  traf ein Sammler-Race: Der Bestands-Coverage-Aggregator startete zwei
  Sekunden nach Ablauf des festen PR-Pollingfensters und endete anschließend
  grün. Der PR-Sammler erhält deshalb wie der Main-Sammler eine absolute
  32-Minuten-Deadline ab seinem tatsächlichen Start und bleibt danach
  fail-closed.

## Laufzeit und Kosten

Für 20 grüne, nach Head-SHA gepaarte Unit-/Coverage-Läufe ergab sich:

| Messgröße                                   | Alt-Orchestrierung |  Shadow | Differenz |
| ------------------------------------------- | -----------------: | ------: | --------: |
| Median terminale Unit-/Coverage-Zeit        |            376,5 s | 454,5 s |     +78 s |
| Median über alle grünen Required-Gate-Paare |                  – |       – |     +75 s |

Die gepaarte Unit-/Coverage-Regression von 78 Sekunden liegt innerhalb der
für die parallele Shadow-Phase festgelegten Grenze von 90 Sekunden. Die
akzeptierte produktive Accelerate-Baseline bleibt 348 Sekunden. Sie wird nicht
mit der temporär doppelten Topologie vermischt: Nach dem Cutover müssen zehn
repräsentative PR-Läufe ohne Alt-/Shadow-Doppelarbeit einen Median von höchstens
438 Sekunden belegen.

Die 20-Run-Stichprobe erzeugte 340 Jobs mit zusammen 443,7 Minuten gemessener
Job-Walltime, durchschnittlich 22,2 Minuten pro Run. Das sind keine auf volle
Billing-Minuten gerundeten GitHub-Kosten, sondern ein vergleichbarer Indikator
für die temporäre Doppelarbeit. Er begründet, den Shadow nicht dauerhaft
weiterzubetreiben.

## Main- und Nightly-Parität

Es wurden 20 Main-/Nightly-Läufe für 16 eindeutige Heads ausgewertet. Seit der
Korrektur der Sammler-Deadline am 30. August 2026 waren zehn von elf Läufen
vollständig paritätisch. Die einzige Ergebnisabweichung in
[Run 33490139042](https://github.com/smart-village-solutions/sva-studio/actions/runs/33490139042)
war ein Fünf-Sekunden-Timeout in
`scripts/ops/runtime/one-shot-job-compose.test.ts`: Der Bestands-Coverage-Lauf
war rot, der Shadow grün. Das ist eine Testflanke im Legacy-Lauf, keine
abweichende Scope- oder Gate-Policy der Zieltopologie.

## Ownership- und Cutover-Grenze

Die vier Altworkflows umfassen in der Baseline zusammen 1.050 YAML-Zeilen. Die
beiden produktiven Nachfolger umfassen im Cutover-Stand zusammen 714 Zeilen und
unterschreiten damit die verbindliche Grenze von 840 Zeilen. Reine PR-/Main-
Paritätsskripte sowie der migrationsspezifische Legacy-Scope sind entfernt;
die Nettoänderung produktiver CI-Orchestrierungs-TypeScript-Dateien ist mit
696 gelöschten Zeilen negativ.

## Nächste Freigabeschritte

1. Den atomaren Cutover-PR über die exakten GitHub-Gates validieren.
2. Am exakten Cutover-Head alle sieben Required-Kontexte prüfen und danach zehn
   repräsentative PR-Läufe auf Doppelarbeit und den Median von höchstens
   438 Sekunden beobachten.
3. Bei fehlendem Required-Kontext, ungeklärter Scope-Unterabdeckung oder
   Ergebnisdrift den vollständigen vorherigen Workflowstand per Revert-Commit
   wiederherstellen.

## Aussagegrenze

Die Live-Artefakte belegen die PR-Scope- und Ergebnisparität sowie die
temporäre Laufzeit- und Kostenwirkung. Die lokale Löschbilanz belegt die
Ownership-Grenze. Noch offen bleiben die Veröffentlichung aller Required-
Kontexte am exakten Cutover-PR-Head und die produktive Post-Cutover-Stichprobe
von zehn repräsentativen Läufen.
