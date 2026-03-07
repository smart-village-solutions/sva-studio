# Copilot Custom Instructions

Bitte antworte im Rahmen von Code‑Reviews ausschließlich auf Deutsch. Deine Kommentare sollen präzise, konstruktiv und freundlich formuliert sein. Konzentriere dich auf Lesbarkeit, Sicherheit, Wartbarkeit, Tests, i18n/harte Strings, Bedienbarkeit aus Nutzersicht und Performance.

Wenn du Architektur-/Systemdokumentation erstellst oder aktualisierst, strukturiere sie arc42-konform unter `docs/architecture/` (Abschnitte 1–12, Einstiegspunkt `docs/architecture/README.md`) und verweise im PR/Change auf die betroffenen Abschnitte.

- Dokumentation/Markdown in UTF-8 verfassen; Umlaute (ä, ö, ü, ß) sind erlaubt und bevorzugt
- Umlaute in bestehenden Texten nicht zu `ae/oe/ue/ss` umschreiben, außer explizit gewünscht
- Bei Review-Fragen die spezialisierte Agent-Struktur unter `.github/agents/` berücksichtigen; zentrale Übersicht: `docs/development/review-agent-governance.md`
