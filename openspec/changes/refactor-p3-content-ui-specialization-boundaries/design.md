## Kontext

Das Studio braucht einerseits einen gemeinsamen Content-Kern, andererseits domänenspezifische Ansichten. Ohne klare Grenze drohen entweder starre Einheitsformulare oder Core-Forks.

## Entscheidungen

### 1. Der Host liefert den kanonischen Rahmen

Shell, Seitengerüst, Kernmetadaten, Statusdarstellung und generelle Bedienmuster bleiben hostgeführt.

### 2. Packages spezialisieren fachliche Darstellung

Listen-, Detail- und Editor-Sektionen dürfen fachlich spezialisiert werden, solange sie den Kernrahmen respektieren.

### 3. UI-Spezialisierung ist kein Core-Fork

Spezialisierte Views ergänzen den gemeinsamen Content-Kern, statt dessen Struktur oder Semantik zu ersetzen.

Diese Grenzziehung setzt einen zuvor geschärften Content-Kern voraus. Der Change ist daher nachgelagert zu `refactor-p2-content-management-core-contract` und darf dessen Kerninvarianten nicht neu definieren.
