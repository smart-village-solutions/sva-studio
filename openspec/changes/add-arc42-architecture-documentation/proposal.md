# Change: arc42-basierte Architekturdokumentation einführen

## Why
Die Architekturinformationen sind aktuell auf mehrere Dokumente verteilt und nicht einheitlich strukturiert. Für Onboarding, Review und Entscheidungsnachverfolgung fehlt ein konsistenter Rahmen.

## What Changes
- Einführung einer Architektur-Dokumentationsstruktur nach arc42 als Projektstandard.
- Definition der verpflichtenden Inhalte pro arc42-Abschnitt mit klaren Verantwortlichkeiten.
- Verknüpfung der arc42-Dokumentation mit OpenSpec-Changes und operativen Runbooks.
- Prüfung aller Agents und Skills (AI-Anweisungen) und gezielte Ergänzung, sodass Architektur-/Systemdoku konsistent in arc42-Struktur erfolgt.

## Impact
- Affected specs: `architecture-documentation`
- Affected code: `docs/architecture/`, relevante Doku-Indexseiten und Referenzen in `docs/`, sowie Agent-/Skill-Anweisungen (`AGENTS.md`, `.github/agents/`, `.github/skills/`, `.github/copilot-instructions.md`)
