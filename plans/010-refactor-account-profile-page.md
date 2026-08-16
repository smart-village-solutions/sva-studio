# Plan 010: Account-Profilseite entflechten

## Status

- Status: DONE
- Priorität: P1
- Aufwand: L
- Risiko: MEDIUM
- Abhängigkeit: laufende IAM-Verträge müssen stabil sein
- Kategorie: React-Komplexität und Accessibility

## Ziel und Ist-Zustand

`apps/sva-studio-react/src/routes/account/-account-profile-page.tsx` enthält in
`AccountProfilePage` einen Fallow-Hotspot mit 46 zyklomatischer, 45 kognitiver
Komplexität und 403 Zeilen. Laden, Editierbarkeit, Validierung, Action-Status,
Mutation und UI sind eng gekoppelt.

## Scope und Vorgehen

- vorhandene Lade-, Fehler-, Read-only-, Bearbeitungs- und Erfolgszustände
  charakterisieren,
- reine Formularableitung und Validierung framework-agnostisch halten,
- Zustands-/Mutationsteuerung von zugänglicher Darstellung trennen,
- bestehende Übersetzungen und Design-System-Komponenten wiederverwenden,
- Fokusführung, Labels und Fehlermeldungszuordnung unverändert absichern.

## Verifikation

- fokussierte Profilseiten-Tests inklusive Keyboard/Fokus und Negativpfaden,
- Studio Unit, Types, Lint, A11y, Complexity-Gate, Fallow, OpenSpec strict,
- betroffenen affected Scope vor breitem Lauf messen.

## Fertig, wenn

- der kritische Komponentenbefund beseitigt ist,
- kein neuer Hook oder Teilbaum kritisch wird,
- UX, i18n, Accessibility und IAM-Editierbarkeit unverändert sind.

## STOP-Bedingungen

- ein paralleler IAM-/Account-PR ändert denselben Vertrag oder dieselbe Seite,
- die bestehende UI zeigt widersprüchliche Editierbarkeitszustände.

## Abschluss

- PR: #993
- Merge-Commit: `c1fe52421fdcd6f0b5df9dcdba50fdba8a4b3312`
- Ergebnis: `AccountProfilePage` von 403 auf 66 Funktionszeilen reduziert;
  alle fünf Produktionsmodule bleiben unter den Fallow-Schwellen. Zusätzlich
  sind Login-Recovery-CTA, i18n-Sprachlabels sowie Fokus- und
  Credential-Rückkehrstatus explizit abgesichert.
