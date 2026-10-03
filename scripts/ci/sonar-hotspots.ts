#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { parseCommand } from './sonar-hotspots-parse.ts';
import {
  fetchHotspots,
  fetchHotspot,
  fetchIssues,
  fetchIssue,
  reviewHotspot,
  transitionIssue,
  commentIssue,
} from './sonar-hotspots-api.ts';
import {
  formatListTable,
  formatListCsv,
  formatIssueTable,
  formatIssueCsv,
  formatHotspotDetails,
  formatIssueDetails,
} from './sonar-hotspots-format.ts';

export { parseCommand } from './sonar-hotspots-parse.ts';
export {
  buildIssueSearchParams,
  buildListSearchParams,
  filterIssues,
  filterHotspots,
  fetchHotspots,
  fetchIssues,
  reviewHotspot,
} from './sonar-hotspots-api.ts';
export {
  formatIssueCsv,
  formatIssueTable,
  formatListCsv,
  formatListTable,
} from './sonar-hotspots-format.ts';
export type { BulkReviewOptions, IssueListOptions, ListOptions } from './sonar-hotspots-types.ts';

const usage = `SonarCloud Hotspots und Issues

Umgebungsvariablen:
  SONAR_TOKEN oder SONARQUBE_TOKEN   API-Token mit Projektberechtigungen

Befehle:
  list                Offene oder gefilterte Hotspots abrufen
  show                Details für einen Hotspot anzeigen
  review              Hotspot als REVIEWED markieren
  bulk-review         Mehrere Hotspots als REVIEWED markieren
  issues:list         Offene oder gefilterte Issues abrufen
  issues:show         Details für ein Issue anzeigen
  issues:transition   Status-Transition auf ein Issue anwenden
  issues:comment      Kommentar an ein Issue hängen

Beispiele:
  tsx scripts/ci/sonar-hotspots.ts list
  tsx scripts/ci/sonar-hotspots.ts list --branch main --status TO_REVIEW
  tsx scripts/ci/sonar-hotspots.ts list --csv
  tsx scripts/ci/sonar-hotspots.ts list --file-path-includes apps/sva-studio-react/src/components
  tsx scripts/ci/sonar-hotspots.ts show --hotspot AXxxxx
  tsx scripts/ci/sonar-hotspots.ts review --hotspot AXxxxx --resolution SAFE --comment "Kein Risiko im konkreten Kontext"
  tsx scripts/ci/sonar-hotspots.ts bulk-review --hotspot AX1 --hotspot AX2 --resolution SAFE --comment "Gleiche technische Begründung"
  tsx scripts/ci/sonar-hotspots.ts issues:list --statuses OPEN,CONFIRMED --types BUG,VULNERABILITY
  tsx scripts/ci/sonar-hotspots.ts issues:show --issue AXxxxx
  tsx scripts/ci/sonar-hotspots.ts issues:transition --issue AXxxxx --transition accept --comment "Akzeptiert im konkreten Kontext"
  tsx scripts/ci/sonar-hotspots.ts issues:comment --issue AXxxxx --comment "Fix ist im aktuellen Branch umgesetzt"
`;

export const run = async (argv: readonly string[]): Promise<number> => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage);
    return 0;
  }

  const command = parseCommand(argv);

  if (command.command === 'list') {
    const hotspots = await fetchHotspots(command);
    if (command.output === 'json') {
      console.log(JSON.stringify(hotspots, null, 2));
      return 0;
    }
    if (command.output === 'csv') {
      console.log(formatListCsv(hotspots));
      return 0;
    }
    console.log(formatListTable(hotspots));
    return 0;
  }

  if (command.command === 'issues:list') {
    const issues = await fetchIssues(command);
    if (command.output === 'json') {
      console.log(JSON.stringify(issues, null, 2));
      return 0;
    }
    if (command.output === 'csv') {
      console.log(formatIssueCsv(issues));
      return 0;
    }
    console.log(formatIssueTable(issues));
    return 0;
  }

  if (command.command === 'show') {
    const hotspot = await fetchHotspot(command);
    console.log(command.json ? JSON.stringify(hotspot, null, 2) : formatHotspotDetails(hotspot));
    return 0;
  }

  if (command.command === 'issues:show') {
    const issue = await fetchIssue(command);
    console.log(command.json ? JSON.stringify(issue, null, 2) : formatIssueDetails(issue));
    return 0;
  }

  if (command.command === 'issues:transition') {
    await transitionIssue(command);
    console.log(`Issue ${command.issueKey} mit Transition ${command.transition} aktualisiert.`);
    return 0;
  }

  if (command.command === 'issues:comment') {
    await commentIssue(command);
    console.log(`Kommentar zu Issue ${command.issueKey} hinzugefügt.`);
    return 0;
  }

  if (command.command === 'review') {
    await reviewHotspot(command);
    console.log(
      `Hotspot ${command.hotspotKey} als ${command.status}/${command.resolution} markiert.`
    );
    return 0;
  }

  for (const hotspotKey of command.hotspotKeys) {
    await reviewHotspot({
      command: 'review',
      baseUrl: command.baseUrl,
      token: command.token,
      hotspotKey,
      status: command.status,
      resolution: command.resolution,
      comment: command.comment,
    });
  }
  console.log(
    `${command.hotspotKeys.length} Hotspots als ${command.status}/${command.resolution} markiert.`
  );
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error(message);
    process.exit(1);
  });
}
