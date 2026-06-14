export const operationsInstancesAdminDEResources = {
  overview: {
    eyebrow: 'Nächster Schritt',
  },
  labels: {
    currentState: 'Gesamtzustand',
    evidence: 'Evidenz: {{value}}',
    evidenceSources: {
      registryContract: 'Registry-Vertrag',
      workerPreflight: 'Worker-Preflight',
      workerPlan: 'Worker-Plan',
      keycloakRun: 'Keycloak-Lauf',
      finalValidation: 'Abschlussvalidierung',
      history: 'Historie',
    },
  },
  followUpSummary:
    'Tenant-IAM-Basis, Modulzuordnung und weitere Folgearbeiten bleiben bewusst vom Realm-Grundaufbau getrennt.',
  status: {
    offen: 'Offen',
    bereit: 'Bereit',
    laeuft: 'Läuft',
    erfolgreich: 'Erfolgreich',
    fehlgeschlagen: 'Fehlgeschlagen',
  },
  new: {
    title: 'Neuen Realm aufbauen',
    stepsTitle: 'Schrittkette für den Realm-Grundaufbau',
    stepsSubtitle:
      'Die Schritte folgen der realen Worker-Kette aus Registry-Vertrag, Vorbedingungen, Provisioning und Abschlussvalidierung.',
    summary: {
      contractIncomplete:
        'Der Registry-Vertrag ist noch unvollständig. Korrigieren Sie zuerst die Pflichtdaten.',
      modeConflict:
        'Der Ziel-Realm steht im Konflikt zum Modus "Neu erstellen". Klären Sie zuerst den Live-Zustand.',
      preflightBlocked:
        'Der Worker meldet blockierende Vorbedingungen. Beheben Sie diese vor dem nächsten Lauf.',
      runFailed:
        'Der letzte technische Lauf ist fehlgeschlagen. Prüfen Sie den betroffenen Schritt und starten Sie danach erneut.',
      bootstrapComplete:
        'Der Realm-Grundaufbau ist erfolgreich abgeschlossen. Folgearbeiten bleiben separat sichtbar.',
      inProgress:
        'Der Realm-Grundaufbau ist vorbereitet oder läuft. Führen Sie den nächsten sichtbaren Schritt aus.',
    },
    steps: {
      registryContract: 'Registry-Vertrag gespeichert',
      workerPreflight: 'Technische Vorbedingungen geprüft',
      workerPlan: 'Worker-Plan erzeugt',
      realm: 'Realm angelegt',
      loginClient: 'Login-Client angelegt oder abgeglichen',
      tenantAdminClient: 'Tenant-Admin-Client angelegt oder abgeglichen',
      realmRoles: 'Realm-Rollen sichergestellt',
      tenantAdmin: 'Tenant-Admin angelegt oder korrigiert',
      secretSync: 'Client-Secrets in Registry synchronisiert',
      finalValidation: 'Abschlusszustand validiert',
      realmBootstrapComplete: 'Realm-Grundaufbau erfolgreich',
    },
    stepSummaries: {
      registryContractReady: 'Die benötigten Registry-Vertragsdaten sind vollständig gespeichert.',
      registryContractFailed:
        'Pflichtdaten im Registry-Vertrag fehlen oder sind technisch unvollständig.',
      workerPreflightPending:
        'Vorbedingungen können erst nach vollständigem Registry-Vertrag belastbar geprüft werden.',
      workerPreflightReady: 'Die Vorbedingungen wurden erfolgreich geprüft.',
      workerPreflightReadyToRun: 'Die Vorbedingungen sollten jetzt geprüft werden.',
      workerPreflightFailed: 'Die Vorbedingungen blockieren den technischen Aufbau aktuell.',
      workerPlanPending: 'Der Worker-Plan folgt nach erfolgreichem Preflight.',
      workerPlanReady: 'Der Worker-Plan liegt vor und beschreibt die technische Ausführung.',
      workerPlanReadyToRun: 'Der Soll-Ist-Plan sollte jetzt geladen werden.',
      pendingWorkerExecution:
        'Dieser Schritt wird im nächsten technischen Lauf erzeugt oder geprüft.',
      awaitingCurrentRun:
        'Dieser Schritt wird durch den aktuellen oder vorgemerkten Lauf bearbeitet.',
      realmReady: 'Der Ziel-Realm ist vorhanden.',
      realmFailed: 'Der Ziel-Realm ist nach dem Lauf noch nicht im Sollzustand.',
      loginClientReady: 'Der Login-Client entspricht dem Sollzustand.',
      loginClientFailed: 'Der Login-Client ist noch nicht vollständig angelegt oder abgeglichen.',
      tenantAdminClientReady: 'Der Tenant-Admin-Client entspricht dem Sollzustand.',
      tenantAdminClientFailed:
        'Der Tenant-Admin-Client ist noch nicht vollständig angelegt oder abgeglichen.',
      realmRolesReady: 'Die minimalen Realm-Rollen sind vorhanden.',
      realmRolesFailed: 'Die minimalen Realm-Rollen entsprechen noch nicht dem Sollzustand.',
      tenantAdminReady: 'Der Tenant-Admin entspricht dem Minimalprofil.',
      tenantAdminFailed:
        'Der Tenant-Admin ist noch nicht vollständig vorhanden oder korrekt zugeordnet.',
      secretSyncReady: 'Die erzeugten Client-Secrets sind in der Registry synchronisiert.',
      secretSyncFailed:
        'Mindestens ein Client-Secret ist noch nicht korrekt mit der Registry abgeglichen.',
      finalValidationReady: 'Die Abschlussvalidierung bestätigt den Zielzustand.',
      finalValidationFailed: 'Die Abschlussvalidierung zeigt noch offene technische Abweichungen.',
      finalValidationPending:
        'Die Abschlussvalidierung folgt nach erfolgreicher technischer Ausführung.',
      bootstrapCompleteReady: 'Der Realm-Grundaufbau ist erfolgreich abgeschlossen.',
      bootstrapCompletePending: 'Der Realm-Grundaufbau ist noch nicht vollständig abgeschlossen.',
    },
  },
  existing: {
    title: 'Bestehenden Realm abgleichen',
    stepsTitle: 'Diagnose- und Reconcile-Schritte',
    stepsSubtitle:
      'Diese Sicht priorisiert Drift, Vertragslücken und Reconcile-Aktionen für bereits existierende Realms.',
    summary: {
      driftDetected:
        'Zwischen Registry-Vertrag und Live-Realm besteht weiterhin Drift oder ein technischer Defekt.',
      reconcileReady:
        'Der bestehende Realm ist geprüft. Nutzen Sie diese Sicht für weitere Reconcile- oder Folgearbeiten.',
    },
    steps: {
      registryContract: 'Registry-Vertrag geprüft',
      workerPreflight: 'Technische Vorbedingungen geprüft',
      liveStatus: 'Live-Status geladen',
      driftAnalysis: 'Drift analysiert',
      contractRepair: 'Vertragsdaten ergänzt',
      reconcile: 'Reconcile ausgeführt',
      resultValidation: 'Ergebnis validiert',
    },
    stepSummaries: {
      registryContractReady: 'Die relevanten Vertragsdaten sind vollständig gepflegt.',
      registryContractFailed: 'Vertragsdaten oder Secrets fehlen noch für einen sauberen Abgleich.',
      workerPreflightPending: 'Vorbedingungen folgen nach vollständigem Vertrag.',
      workerPreflightReady: 'Die Vorbedingungen erlauben die technische Prüfung.',
      workerPreflightReadyToRun: 'Die Vorbedingungen sollten jetzt geprüft werden.',
      workerPreflightFailed: 'Die Vorbedingungen blockieren den Abgleich aktuell.',
      liveStatusReady: 'Der Live-Zustand des Realm wurde geladen.',
      liveStatusPending: 'Der Live-Zustand sollte jetzt gegen Keycloak geladen werden.',
      driftAnalysisPending: 'Eine belastbare Driftanalyse folgt nach dem Live-Status.',
      driftAnalysisReady: 'Der Live-Zustand entspricht aktuell dem gepflegten Vertrag.',
      driftAnalysisFailed: 'Der Live-Zustand weicht aktuell vom gepflegten Vertrag ab.',
      contractRepairReady: 'Die Vertragsdaten sind für den Reconcile-Lauf vollständig.',
      contractRepairFailed: 'Ergänzen Sie zuerst fehlende Secrets oder Vertragsdaten.',
      reconcilePending: 'Ein Reconcile-Lauf ist erst nach Driftanalyse sinnvoll.',
      reconcileReadyToRun:
        'Die Drift ist sichtbar. Ein Reconcile-Lauf ist jetzt die nächste sinnvolle Aktion.',
      reconcileReady: 'Der letzte Reconcile-Lauf hat den Zustand erfolgreich angeglichen.',
      reconcileFailed: 'Der letzte Reconcile-Lauf ist fehlgeschlagen oder unvollständig.',
      resultValidationPending: 'Die Ergebnisvalidierung folgt nach dem Reconcile-Lauf.',
      resultValidationReady: 'Die Ergebnisvalidierung bestätigt den abgeglichenen Zustand.',
      resultValidationFailed: 'Die Ergebnisvalidierung zeigt weiterhin offene Drift oder Defekte.',
    },
  },
} as const;
