# Change: Account-Profilseite intern entflechten

## Why

Die Account-Profilseite bündelt Datenladen, Fehlerbehandlung, Formularzustand, Validierung, Mutation und Darstellung in einer einzelnen großen React-Komponente. Diese Bündelung erschwert sichere Änderungen an einem zentralen Self-Service-Einstieg, obwohl das sichtbare Verhalten bereits fachlich festgelegt ist.

## What Changes

- Die reine Ableitung und Validierung von Profilformularwerten wird aus React herausgelöst.
- Lade-, Fehler-, Read-only-, Bearbeitungs- und Mutationszustände werden in kleinere, klar verantwortete Bausteine getrennt.
- Bestehende Übersetzungen, Design-System-Komponenten, Fokusführung, Fehlerzuordnung und IAM-seitige Editierbarkeit bleiben unverändert.
- Der bereits implementierte Change `add-account-credential-self-service` bleibt ein orthogonaler Vertrag: Passwort-, E-Mail-, Abbruch-, fehlende und ungültige Rückkehrstatus werden nur charakterisiert und unverändert weitergereicht. Seine bestehende `MODIFIED`-Anforderung wird hier weder dupliziert noch überschrieben.

## Impact

- Betroffener Code: `apps/sva-studio-react/src/routes/account/` und direkt zugehörige Tests
- Betroffene Spezifikation: `account-ui` (nur zusätzliche Refactoring-Sicherungsanforderung)
- Keine API-, IAM-, Routing-, Übersetzungs- oder sichtbare UI-Vertragsänderung
