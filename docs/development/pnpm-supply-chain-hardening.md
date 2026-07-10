# pnpm-Supply-Chain-Hardening

## Ziel

Dieses Repository nutzt `pnpm@11.3.0` nicht nur als Package-Manager, sondern auch als zusätzliche Supply-Chain-Schutzschicht. Die Konfiguration soll verhindern, dass frische oder vertrauensseitig auffällige Releases ungeprüft in lokale Installationen, CI-Läufe oder Lockfile-Regenerationen gelangen.

## Aktive Schutzmechanismen

Die verbindliche Konfiguration liegt in [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml):

- `minimumReleaseAge: 1440`
  Neue Releases müssen mindestens 24 Stunden alt sein, bevor sie automatisch installiert werden.
- `engineStrict: true`
  Nicht unterstützte `node`- oder `pnpm`-Versionen werden bereits auf Resolver-Ebene abgewiesen.
- `nodeVersion: 24.15.0`
  Der Workspace erzwingt denselben Node-Zielstand wie `.nvmrc`, `.node-version` und die deklarierte Toolchain.
- `minimumReleaseAgeStrict: true`
  Wenn innerhalb des angefragten Ranges nur zu frische Versionen existieren, bricht die Auflösung bewusst ab.
- `minimumReleaseAgeIgnoreMissingTime: false`
  Fehlende Zeitmetadaten werden nicht stillschweigend akzeptiert.
- `trustPolicy: no-downgrade`
  Versionen mit schwächerem Vertrauenssignal als frühere Releases desselben Pakets werden blockiert.
- `allowBuilds`
  Installationsskripte von Dependencies laufen nur nach expliziter Freigabe.
- `overrides`
  Kritische transitive Auflösungen können gezielt gepinnt oder eingegrenzt werden, wenn ein aktueller Resolver-Graph sonst kompromittierte oder vertrauensseitig beanstandete Versionen ziehen würde.

## Warum pnpm 11.3.0

Die v11-Linie bringt die relevanten Sicherheitsfunktionen direkt im Standardpfad mit:

- Lockfile-Prüfung gegen `minimumReleaseAge` und `trustPolicy`
- Engine-/Runtime-Prüfung über `engineStrict` und `nodeVersion`
- explizite Freigabe von Dependency-Buildskripten
- bessere Konfiguration der Supply-Chain-Regeln über `pnpm-workspace.yaml`

Dadurch werden kompromittierte oder verdächtige Releases früher abgefangen, bevor sie still im Lockfile oder in CI-Installs landen.

## Umgang mit Ausnahmen

Ausnahmen sind erlaubt, aber nur eng begrenzt:

1. **Zuerst bevorzugen:** sicheren Direktstand oder gezielten `overrides`-Pin wählen.
2. **Nur wenn das nicht reicht:** `trustPolicyExclude` oder `minimumReleaseAgeExclude` auf exakte Pakete oder Versionen begrenzen.
3. **Nie verwenden:** globale Abschwächungen wie `dangerouslyAllowAllBuilds: true` oder breite Excludes für ganze Ökosysteme.
4. **Immer dokumentieren:** Grund, betroffene Version und Rückbauabsicht in derselben Änderung festhalten.

Die aktuelle Konfiguration enthält bewusst enge Ausnahmen und Pins für konkret beobachtete Problemknoten aus dem Resolver-Graph. Diese Einträge sind kein Dauerfreifahrtschein und sollen bei regulären Dependency-Refreshes erneut überprüft werden.

Aktueller dokumentierter Sonderfall:

- `trustPolicyExclude: semver@6.3.1`
  Diese Ausnahme ist auf genau eine transitive Legacy-Version begrenzt, die derzeit noch über den Nx-/Babel-/TanStack-Plugin-Graph aufgelöst wird. Sie dient nicht als generelle Freigabe für `semver`, sondern nur als enges Workaround für diesen konkreten Knoten. Rückbauziel: Eintrag entfernen, sobald die betroffenen Upstream-Abhängigkeiten keinen `semver`-6.x-Pfad mehr erzwingen.
- `allowBuilds: nx@22.7.1 || 22.7.4 || 23.0.1`
  `nx@23.0.1` wurde vor Freigabe gezielt auditiert. Ergebnis: identischer `postinstall`-Pfad zu `22.7.4`, keine aktive Nx-Cloud-Nutzung im Repository und kein bekannter Advisory-Treffer für diese Version.

## Buildskripte

pnpm 11 behandelt Buildskripte von Dependencies standardmäßig als unreviewed. Für dieses Repository gilt:

- echte Runtime-/Binary-Abhängigkeiten wie `esbuild`, `nx` und `sharp` dürfen explizit laufen
- nicht zwingend benötigte Nachbearbeitungsskripte bleiben standardmäßig blockiert, bis ein konkreter Bedarf nachgewiesen ist

Neue Buildskripte dürfen nur nach expliziter Review in `allowBuilds` aufgenommen werden.

## Operativer Hinweis

Wenn ein frischer Install an `minimumReleaseAge`, `trustPolicy` oder `allowBuilds` scheitert, ist das zunächst ein gewollter Sicherheitsstopp und kein bloßes Tooling-Problem. Erst Resolver-Ursache, Version und Vertrauenssignal klären; erst danach gezielt nachsteuern.
