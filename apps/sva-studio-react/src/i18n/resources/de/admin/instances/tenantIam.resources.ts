export const tenantIamInstancesAdminDEResources = {
  title: 'Tenant-IAM-Betrieb',
  subtitle: 'Getrennte Sicht auf Konfiguration, Rechteprobe und Rollenabgleich der Instanz.',
  requestId: 'Request-ID: {{value}}',
  axes: {
    configuration: 'Konfiguration',
    access: 'Rechteprobe',
    reconcile: 'Reconcile',
  },
  summaries: {
    configurationReady: 'Tenant-IAM-Struktur ist vollständig vorhanden.',
    configurationDegraded: 'Tenant-IAM-Struktur ist unvollständig oder driftet.',
    overallReady: 'Tenant-IAM ist betriebsbereit.',
    overallBlocked: 'Tenant-IAM ist blockiert.',
    overallDegraded: 'Tenant-IAM ist eingeschränkt.',
    overallUnknown: 'Tenant-IAM-Befund ist unvollständig.',
  },
} as const;
