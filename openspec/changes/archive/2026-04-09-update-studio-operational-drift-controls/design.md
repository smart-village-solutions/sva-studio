## Context

Die Incident-Reports fuer `studio` zeigen wiederholt, dass lokale Gruen-Signale und Swarm-Gesundheit allein keinen belastbaren Betriebsnachweis liefern. Fehler traten zuletzt durch falsche Image-Plattformen, Schema-Drift, fehlende Registry-/Auth-Daten, aktive RLS auf Runtime-Tabellen sowie unvollstaendige Live-Service-Specs auf. Gleichzeitig konnte die App von aussen bereits gesund sein, waehrend Operator-Werkzeuge durch lokalen Hidden State oder instabile Remote-Zugaenge ausfielen.

Die bereits offenen Changes `update-quantum-ops-decoupling`, `update-rollout-observability-gates` und `update-studio-rollout-network-consistency` adressieren Teilursachen. Dieser Change konzentriert sich auf die verbleibende Querschnittsluecke: der dokumentierte und technisch erzwungene Betriebsvertrag, der Drift vor und nach dem eigentlichen Rollout begrenzen soll.

## Goals / Non-Goals

- Goals:
  - prod-nahen Nachweis vor mutierenden Remote-Deploys erzwingen
  - Registry-, Auth- und RLS-Fehler aus derselben DB-Perspektive erkennen, die auch die App verwendet
  - manuelle Incident-Recovery in einen kanonischen Reconcile-Pfad zurueckfuehren
  - die Aussagegrenzen lokaler gruener Tests gegenueber `studio` explizit machen
- Non-Goals:
  - Quantum fuer alle Mutationen sofort ersetzen
  - die Sicherheits- oder Routing-Architektur in diesem Change neu entwerfen
  - den gesamten Observability-Stack neu aufbauen

## Decisions

- Decision: Prod-nahe Paritaet wird als eigener Gate-Schritt vor Remote-Deploy modelliert.
  - Rationale: Lokale Unit-, Integrations- und Dev-E2E-Tests pruefen nicht denselben Vertragsraum wie `studio`.
  - Consequence: Der Gate-Schritt muss ein produktionsnahes Runtime-Profil verwenden und mindestens Root- und Tenant-Smokes pruefen.

- Decision: Deployment-Health fuer Registry und Auth wird aus Sicht von `APP_DB_USER` bewertet.
  - Rationale: Superuser-basierte Checks koennen gruene Signale liefern, obwohl RLS oder Grants die laufende App effektiv aussperren.
  - Consequence: Precheck, Doctor und Post-Deploy-Verifikation muessen denselben Principal oder eine technisch gleichwertige Perspektive nutzen wie die App zur Laufzeit.

- Decision: Manuelle Eingriffe gelten nur als Incident-Recovery und muessen in einen kanonischen Reconcile muenden.
  - Rationale: Ad-hoc-Reparaturen erzeugen oft weiteren Drift zwischen Soll-Render, Live-Spec und dokumentiertem Deploy-Pfad.
  - Consequence: Nach Portainer- oder Quantum-Seiteneingriffen ist ein definierter Soll-/Ist-Abgleich mit nachgelagerter Verifikation verpflichtend.

- Decision: Die Differenz zwischen lokalem Development und `studio` wird als explizite Vertragsgrenze dokumentiert.
  - Rationale: Solange Teams lokale gruene Tests als hinreichenden Proxy fuer `studio` interpretieren, bleibt Drift systematisch unsichtbar.
  - Consequence: Dokumentation und Gates muessen klarstellen, welche Aussagen lokale Tests liefern und welche nicht.

## Risks / Trade-offs

- Ein prod-nahes Gate verlaengert den Weg bis zum Remote-Deploy.
  - Mitigation: Scope auf die driftrelevanten Smokes begrenzen und bestehende Build-Artefakte wiederverwenden.

- APP-Principal-Checks benoetigen saubere technische Nachweise ohne unsichere Secret-Handhabung.
  - Mitigation: vorhandene Runtime-Secrets und Job-/HTTP-basierte Nachweise bevorzugen statt ad-hoc-SQL aus lokalen Shells.

- Der Change beruehrt offene Proposal-Slices mit aehnlichem Kontext.
  - Mitigation: Quantum-, Observability- und Netzwerk-Hardening bleiben eigene Changes; dieser Change referenziert sie bewusst als Abhaengigkeiten.

## Migration Plan

1. Parity-Gate und Dokumentationsgrenzen definieren, ohne den bestehenden Rolloutpfad sofort hart zu blockieren.
2. Registry-/RLS-/Auth-Nachweise aus Sicht von `APP_DB_USER` in Precheck und Post-Deploy integrieren.
3. Kanonischen Reconcile-Pfad dokumentieren und nach manuellen Eingriffen verbindlich machen.
4. Nach Stabilisierung der abhaengigen Changes die Gates fuer `studio` verpflichtend scharf schalten.

## Open Questions

- Soll das prod-nahe Parity-Gate zuerst nur in CI laufen oder zusaetzlich lokal als expliziter Ops-Target verfuegbar sein?
- Reicht fuer den ersten Schritt ein Container-Start mit Root-/Tenant-Smoke, oder wird ein kleines produktionsnahes Compose-/Stack-Profil benoetigt?
