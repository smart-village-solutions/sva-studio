import {
  projectPriorityModel,
  projectStatusModel,
  validateProjectStatusReport,
  type ProjectPriority,
  type ProjectStatus,
  type ProjectStatusReportContract,
} from './project-status';

export type EditableMilestoneOption = Readonly<{
  id: string;
  label: string;
}>;

export type EditableValueOption<TValue extends string> = Readonly<{
  id: TValue;
}>;

export type EditableWorkPackageOptions = Readonly<{
  milestones: readonly EditableMilestoneOption[];
  statuses: readonly EditableValueOption<ProjectStatus>[];
  priorities: readonly EditableValueOption<ProjectPriority>[];
}>;

export type UpdateWorkPackageAssignmentInput = Readonly<{
  workPackageId: string;
  milestoneId: string;
  priority: ProjectPriority;
  status: ProjectStatus;
}>;

const localProjectStatusHosts = new Set(['localhost', '127.0.0.1', '::1']);

const compareWorkPackageIds = (left: string, right: string) =>
  left.localeCompare(right, 'de-DE', { numeric: true, sensitivity: 'base' });

const isKnownStatus = (value: string): value is ProjectStatus => value in projectStatusModel;
const isKnownPriority = (value: string): value is ProjectPriority => value in projectPriorityModel;

const uniqueOrderedValues = <TValue extends string>(values: readonly TValue[]): readonly EditableValueOption<TValue>[] => {
  const seen = new Set<TValue>();
  const entries: EditableValueOption<TValue>[] = [];

  values.forEach((value) => {
    if (seen.has(value)) {
      return;
    }

    seen.add(value);
    entries.push({ id: value });
  });

  return entries;
};

export const isLocalProjectStatusHost = (hostname: string): boolean => localProjectStatusHosts.has(hostname);

export const getEditableWorkPackageOptions = (
  report: ProjectStatusReportContract
): EditableWorkPackageOptions => {
  const milestones = report.milestones
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry) => ({
      id: entry.id,
      label: `${entry.id} · ${entry.title}`,
    }));

  const statuses = uniqueOrderedValues(
    report.milestones.flatMap((milestone) => milestone.workPackages.map((workPackage) => workPackage.status))
  );
  const priorities = uniqueOrderedValues(
    report.milestones.flatMap((milestone) => milestone.workPackages.map((workPackage) => workPackage.priority))
  );

  return {
    milestones,
    statuses,
    priorities,
  };
};

export const updateWorkPackageAssignment = (
  report: ProjectStatusReportContract,
  input: UpdateWorkPackageAssignmentInput
): ProjectStatusReportContract => {
  if (!isKnownPriority(input.priority)) {
    throw new Error(`Unknown priority: ${input.priority}`);
  }
  if (!isKnownStatus(input.status)) {
    throw new Error(`Unknown status: ${input.status}`);
  }

  const sourceMilestone = report.milestones.find((milestone) =>
    milestone.workPackages.some((workPackage) => workPackage.id === input.workPackageId)
  );

  if (!sourceMilestone) {
    throw new Error(`Unknown work package id: ${input.workPackageId}`);
  }

  const targetMilestone = report.milestones.find((milestone) => milestone.id === input.milestoneId);

  if (!targetMilestone) {
    throw new Error(`Unknown milestone id: ${input.milestoneId}`);
  }

  const currentWorkPackage = sourceMilestone.workPackages.find((workPackage) => workPackage.id === input.workPackageId);

  if (!currentWorkPackage) {
    throw new Error(`Unknown work package id: ${input.workPackageId}`);
  }

  const nextWorkPackage = {
    ...currentWorkPackage,
    priority: input.priority,
    status: input.status,
  };

  const nextMilestones = report.milestones.map((milestone) => {
    if (milestone.id === sourceMilestone.id && sourceMilestone.id === targetMilestone.id) {
      return {
        ...milestone,
        workPackages: milestone.workPackages.map((workPackage) =>
          workPackage.id === input.workPackageId ? nextWorkPackage : workPackage
        ),
      };
    }

    if (milestone.id === sourceMilestone.id) {
      return {
        ...milestone,
        workPackages: milestone.workPackages.filter((workPackage) => workPackage.id !== input.workPackageId),
      };
    }

    if (milestone.id === targetMilestone.id) {
      return {
        ...milestone,
        workPackages: [...milestone.workPackages, nextWorkPackage].sort((left, right) =>
          compareWorkPackageIds(left.id, right.id)
        ),
      };
    }

    return milestone;
  });

  const nextReport = {
    ...report,
    milestones: nextMilestones,
  } satisfies ProjectStatusReportContract;

  const validationErrors = validateProjectStatusReport(nextReport);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid project status report:\n${validationErrors.join('\n')}`);
  }

  return nextReport;
};
