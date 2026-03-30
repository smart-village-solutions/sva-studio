# Übersicht fachlicher Zuständigkeiten

Dieses Diagramm stellt die fachlichen und technischen Verantwortlichkeiten der zentralen Packages dar. Im Unterschied zur Request-Fluss-Sicht steht hier nicht der Ablauf eines einzelnen Requests im Vordergrund, sondern die Frage, welches Package welche Rolle im System übernimmt.

## Mermaid-Diagramm

```mermaid
flowchart TB
    A["apps/sva-studio-react\nUI, Seiten, SSR, Server Functions"]

    B["@sva/routing\nRouting-Bruecke\nRoute-Factories\nServer-Route-Mapping"]
    C["@sva/auth\nIdentitaet, Session,\nBerechtigung, IAM-Workflows"]
    D["@sva/data\nPersistenz,\nPostgres-Zugriff,\ninstanzgebundene Daten"]
    E["@sva/sva-mainserver\nIntegrationslogik fuer\nexternen Mainserver"]
    F["@sva/sdk\nLogging, Request-Kontext,\nFehlerantworten,\nObservability"]
    G["@sva/core\nFachlicher Kern\nTypen, Regeln,\nRouting-Registry,\nAuthorization-Engine,\nSecurity-Helfer"]

    H["Postgres"]
    I["Redis"]
    J["Keycloak / IdP"]
    K["Externer Mainserver"]

    A --> B
    A --> C
    A --> E
    A --> F
    A --> G

    B --> G
    B --> C

    C --> G
    C --> F
    C --> D
    C --> I
    C --> J

    D --> G
    D --> H

    E --> C
    E --> D
    E --> F
    E --> G
    E --> J
    E --> K

    F --> G

    classDef app fill:#e8f1ff,stroke:#2f5ea8,color:#10243f
    classDef foundation fill:#eef7ea,stroke:#4d7c3a,color:#18361a
    classDef backend fill:#fff5e8,stroke:#9a6424,color:#4a2a00
    classDef external fill:#f4f4f5,stroke:#6b7280,color:#111827

    class A app
    class B,C,D,E,F,G foundation
    class H,I,J,K external
```

## Kurzlesart

- `@sva/core` ist der fachliche Kern und liefert die gemeinsamen Regeln, Typen und Kernabstraktionen.
- `@sva/sdk` stellt querschnittliche Infrastruktur bereit, vor allem Logging, Kontext und Observability.
- `@sva/auth` verantwortet Identität, Session und IAM-nahe Fachlogik.
- `@sva/data` kapselt Persistenz und Datenbankzugriff.
- `@sva/sva-mainserver` ist ein spezialisiertes Integrationspaket fuer einen externen Downstream.
- `@sva/routing` verbindet den fachlichen Kern mit der konkreten Routing- und Server-Route-Integration.
- `apps/sva-studio-react` ist die Anwendungsoberflaeche und orchestriert die Nutzung dieser Bausteine.
