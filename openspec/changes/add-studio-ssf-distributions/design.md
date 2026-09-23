## Context

Die aktuellen Remote-Profile deaktivieren SSF-Datenbank und -Runtime, der
statische Plugin-Katalog aktiviert `ssf` aber weiterhin. Runtime-Variablen
sind daher keine ausreichende Grenze für Browser-Routen, Navigation,
Server-Handler oder Job-Beiträge.

## Goals / Non-Goals

### Goals

- Das Standard-Studio liefert und registriert SSF nicht.
- Die SSF-Distribution bleibt ein eigenständiges, prüfbares Artefakt.
- Alle Plugin-Verbraucher sehen dieselbe distributionsgebundene Menge.
- Bestehende SSF-Daten oder Aktivierungszeilen werden nicht gelöscht.

### Non-Goals

- Keine Änderung am SSF-Fachvertrag oder an Tenant-Daten.
- Keine dynamische Plugin-Installation oder Laufzeitumschaltung.
- Kein direkter Infrastruktur- oder Quantum-Rollout.

## Decisions

### Build-Zeit-Distribution als führende Grenze

`SVA_STUDIO_DISTRIBUTION` ist ein validierter Build-Input mit den Werten
`studio` und `ssf`. Ohne Angabe wird `studio` gebaut. Die laufende Anwendung
kann die Distribution nicht wechseln oder erweitern.

### Ein gemeinsamer Katalog für alle Verbraucher

Die Build-Zeit-Auswahl beschränkt vor dem Laden der Entry-Points den
Plugin-Katalog und die Host-Modulverträge. Damit entstehen SSF-Routen,
Navigation, Server-Handler, Job-Handler und IAM-Verträge im Standard-Studio
nicht. Historische Persistenz bleibt unbeeinflusst und wird nicht als
Verfügbarkeit interpretiert.

### Zwei attestierte OCI-Artefakte

Der reguläre Build veröffentlicht das Studio-Image und das SSF-Image getrennt.
Ein Artefaktmanifest und die Image-Verifikation prüfen die behauptete
Distribution sowie das positive und negative Plugin-Inventar. Promotion darf
nur einen zur Ziel-Distribution passenden Digest verwenden.

## Risks / Trade-offs

- Ein statischer Import kann ein ausgeschlossenes Plugin unbemerkt wieder in
  ein Artefakt ziehen. Die Negativprüfung ist deshalb ein Release-Gate.
- Getrennte Images haben eigene Digests. Eine Promotion vergleicht immer nur
  innerhalb derselben Distribution.
- Persistierte, ausgeschlossene Modulzeilen bleiben erhalten, aber nicht
  sichtbar oder zuweisbar.

## Migration Plan

1. Katalog- und Runtime-Auswahl mit Unit- und Artefakt-Tests einführen.
2. Beide Images in CI bauen und gegen ihr Inventar prüfen.
3. Die vorhandenen Staging- und Produktionsziele weiterhin ausschließlich mit
   `studio` promoten.
4. SSF-Ziele erst nach separater Ziel- und Digest-Verifikation mit `ssf`
   promoten.

Rollback ist der zuvor verifizierte Digest derselben Distribution; es sind
keine Datenmigrationen erforderlich.
