import {
  projectHealthModel,
  projectPriorityModel,
  projectStatusModel,
  type ProjectHealth,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectStatusMilestone,
  type ProjectStatusReportContract,
  type ProjectStatusWorkPackage,
} from './project-status';
import type { ReportFilterState } from './url-state';

export type ProjectStatusReport = ProjectStatusReportContract;
export type ProjectMilestone = ProjectStatusMilestone;
export type ProjectWorkPackage = ProjectStatusWorkPackage;

export type SelectOption = Readonly<{
  id: string;
  label: string;
}>;

export type MilestoneSummary = Readonly<{
  id: string;
  title: string;
  plannedEffortPt: number;
  scheduledEffortPt: number;
  completionPercent: number;
  workPackageCount: number;
  health: ProjectHealth;
}>;

export type WorkPackageRow = Readonly<ProjectWorkPackage & {
  milestoneId: string;
  milestoneTitle: string;
  progressPercent: number;
  priorityLabel: string;
}>;

export type ProjectReportModel = Readonly<{
  milestones: readonly MilestoneSummary[];
  workPackages: readonly WorkPackageRow[];
  availableMilestones: readonly SelectOption[];
  availableStatuses: readonly SelectOption[];
  availableHealthStates: readonly SelectOption[];
  availablePriorities: readonly SelectOption[];
}>;

const severityByHealth: Record<ProjectHealth, number> = {
  on_track: 0,
  needs_attention: 1,
  at_risk: 2,
  blocked: 3,
};

const allOptionLabels = {
  milestones: 'Alle Meilensteine',
  statuses: 'Alle Status',
  health: 'Alle Warnstufen',
  priorities: 'Alle Prioritäten',
} as const;

const roundToInteger = (value: number) => Math.round(value);

const normalizeText = (value: string) => value.trim().toLocaleLowerCase('de-DE');

export const deriveProgressFromStatus = (report: ProjectStatusReport, status: ProjectStatus): number => report.statusModel[status];

const flattenWorkPackages = (report: ProjectStatusReport): WorkPackageRow[] =>
  report.milestones.flatMap((milestone) =>
    milestone.workPackages.map((entry) => ({
      ...entry,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      progressPercent: deriveProgressFromStatus(report, entry.status),
      priorityLabel: report.priorityModel[entry.priority],
    }))
  );

const matchesFilter = (workPackage: WorkPackageRow, milestoneTitle: string, filters: ReportFilterState): boolean => {
  if (filters.milestone !== 'all' && workPackage.milestoneId !== filters.milestone) {
    return false;
  }
  if (filters.status !== 'all' && workPackage.status !== filters.status) {
    return false;
  }
  if (filters.health !== 'all' && workPackage.health !== filters.health) {
    return false;
  }
  if (filters.priority !== 'all' && workPackage.priority !== filters.priority) {
    return false;
  }

  const query = normalizeText(filters.q);
  if (query.length === 0) {
    return true;
  }

  const haystack = [workPackage.id, workPackage.title, workPackage.area, milestoneTitle].map(normalizeText).join(' ');
  return haystack.includes(query);
};

const createSelectOptions = (allLabel: string, entries: readonly SelectOption[]): readonly SelectOption[] => [
  { id: 'all', label: allLabel },
  ...entries,
];

export const createProjectReportModel = (report: ProjectStatusReport, filters: ReportFilterState): ProjectReportModel => {
  const milestonesById = new Map(report.milestones.map((entry) => [entry.id, entry] as const));

  const workPackages = flattenWorkPackages(report)
    .filter((entry) => matchesFilter(entry, entry.milestoneTitle, filters));

  const milestoneSummaries = report.milestones
    .map<MilestoneSummary>((milestone) => {
      const matchingPackages = workPackages.filter((entry) => entry.milestoneId === milestone.id);
      const computedPackages = matchingPackages.filter((entry) => entry.status !== 'idea');
      const scheduledEffortPt = computedPackages.reduce((sum, entry) => sum + entry.effortPt, 0);
      const weightedProgress = computedPackages.reduce((sum, entry) => sum + entry.effortPt * entry.progressPercent, 0);
      const completionPercent = scheduledEffortPt === 0 ? 0 : roundToInteger(weightedProgress / scheduledEffortPt);
      const health = computedPackages.reduce<ProjectHealth>(
        (current, entry) => (severityByHealth[entry.health] > severityByHealth[current] ? entry.health : current),
        'on_track'
      );

      return {
        id: milestone.id,
        title: milestone.title,
        plannedEffortPt: milestone.plannedEffortPt,
        scheduledEffortPt: roundToInteger(scheduledEffortPt * 10) / 10,
        completionPercent,
        workPackageCount: matchingPackages.length,
        health,
      };
    })
    .filter((entry) => {
      if (filters.view === 'milestones') {
        if (filters.milestone === 'all') {
          return true;
        }
        return entry.id === filters.milestone;
      }
      return entry.workPackageCount > 0;
    })
    .sort((left, right) => {
      const leftMilestone = milestonesById.get(left.id);
      const rightMilestone = milestonesById.get(right.id);
      return (leftMilestone?.sortOrder ?? 0) - (rightMilestone?.sortOrder ?? 0);
    });

  return {
    milestones: milestoneSummaries,
    workPackages,
    availableMilestones: createSelectOptions(
      allOptionLabels.milestones,
      report.milestones
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((entry) => ({ id: entry.id, label: entry.title }))
    ),
    availableStatuses: createSelectOptions(
      allOptionLabels.statuses,
      (Object.keys(projectStatusModel) as ProjectStatus[]).map((entry) => ({
        id: entry,
        label: report.statusModel[entry].toString().padStart(3, ' ') + '% · ' + entry,
      }))
    ),
    availableHealthStates: createSelectOptions(
      allOptionLabels.health,
      projectHealthModel.map((entry) => ({ id: entry, label: entry }))
    ),
    availablePriorities: createSelectOptions(
      allOptionLabels.priorities,
      (Object.keys(projectPriorityModel) as ProjectPriority[]).map((entry) => ({
        id: entry,
        label: report.priorityModel[entry],
      }))
    ),
  };
};
