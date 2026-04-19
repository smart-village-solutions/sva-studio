## ADDED Requirements

### Requirement: Pluginbezogene Audit-Ereignisse folgen derselben Namespace-Governance

Das System SHALL pluginbezogene Audit-Ereignisse mit derselben Namespace-Governance wie andere Plugin-Beiträge versehen.

#### Scenario: Audit-Ereignis ist dem Plugin zuordenbar

- **WHEN** ein pluginbezogenes Audit-Ereignis protokolliert wird
- **THEN** ist der technische Ereignisname eindeutig dem verantwortlichen Plugin-Namensraum zuordenbar
- **AND** Audit-Ereignisse kollidieren nicht mit Host- oder Fremd-Events
