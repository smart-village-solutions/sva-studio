# ADR-038: Instanz-Modul-Zuordnung und fail-closed Modulaktivierung

## Status

Angenommen

## Kontext

Studio kennt Plugins global zur Build-Zeit, musste aber bislang nicht normativ unterscheiden, ob ein Modul für eine konkrete Instanz fachlich freigegeben ist. Dadurch konnten Routing, Navigation und IAM-Basis auseinanderlaufen.

## Entscheidung

1. Die kanonische Betriebsquelle für Modulfreigaben ist `iam.instance_modules`.
2. Die IAM-Basis einer Instanz wird deterministisch aus `Core + zugewiesene Module` abgeleitet.
3. Module werden hart entzogen. Modulbezogene Permissions und `role_permissions` bleiben nach Entzug nicht als Altlast bestehen.
4. Client-Routing und Navigation arbeiten fail-closed gegen die kanonische `assignedModules`-Liste der aktiven Instanz-Session.
5. Der deklarative Modul-IAM-Vertrag wird in `@sva/plugin-sdk` pro Plugin definiert.

## Begründung

- Die Freigabelogik bleibt an einer einzigen Datenquelle.
- Routing, Navigation und Rechtebasis verwenden denselben Modulsatz.
- Bestandsinstanzen ohne Zuordnung starten sicher mit leerem Modulsatz.
- Entzug und Reparaturpfad bleiben operativ nachvollziehbar.

## Konsequenzen

### Positiv

- globale Plugin-Registrierung bleibt erhalten, aktiviert aber nichts implizit
- `auth/me` kann fail-closed dieselbe Modulliste an den Client ausgeben
- Instanzdetail und Modulbereich sprechen über denselben Diagnosekern

### Negativ

- Bestandsinstanzen benötigen explizite Erstbefüllung
- neue Module benötigen einen vollständigen `moduleIam`-Vertrag
- Modulaktivierung erweitert die Kopplung zwischen Registry, Session-Kontext, Routing und Sidebar bewusst

## Verworfen

- Implizite Aktivierung über `featureFlags` oder Integrationsdaten
  - verworfen, weil damit zwei Wahrheitsquellen für Freigaben entstehen
- Soft-Remove mit liegenbleibenden Rechten
  - verworfen, weil Entzug dann nicht deterministisch überprüfbar ist

## Bezug

- arc42 05 Bausteinsicht
- arc42 06 Laufzeitsicht
- arc42 08 Querschnittliche Konzepte
- arc42 11 Risiken und technische Schulden
- OpenSpec-Change `add-instance-module-activation`
