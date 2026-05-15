# Change: Zentrale Registry für externe Schnittstellen

## Why

Das Studio braucht einen kanonischen, host-owned Persistenz- und Resolver-Pfad für externe technische Schnittstellen. Bisher war die Mainserver-Konfiguration als Spezialfall modelliert, während weitere Typen wie S3 und Supabase keinen gleichwertigen produktiven Backend-Pfad hatten.

## What Changes

- neue Host-Capability für externe Schnittstellen mit zentralem Typkatalog und Instanz-Records
- verschlüsselte Secret-Blöcke und zentraler Runtime-Resolver
- Migration der Mainserver-Konfiguration in denselben Registry-Pfad
- Erweiterung des Plugin-SDK um deklarative `externalInterfaceTypes`
- UI- und Serveradapter für `/interfaces` auf Basis der Registry

## Impact

- Affected specs: `external-interface-registry`, `sva-mainserver-integration`
- Affected code: `packages/core`, `packages/plugin-sdk`, `packages/data-repositories`, `packages/server-runtime`, `packages/sva-mainserver`, `apps/sva-studio-react`, `packages/data/migrations`
- Affected arc42 sections: `03-context-and-scope`, `05-building-block-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`
