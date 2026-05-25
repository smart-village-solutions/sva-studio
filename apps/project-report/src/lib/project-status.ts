export const projectStatusModel = {
  idea: 0,
  commissioned: 0,
  planned: 10,
  prototype: 20,
  implementation: 45,
  optimization: 70,
  testing: 80,
  acceptance: 90,
  done: 100,
} as const;

export const projectHealthModel = ['on_track', 'needs_attention', 'at_risk', 'blocked'] as const;

export const projectPriorityModel = {
  must: '1: Muss sein',
  replacement_required: '2: Notwendig für die Ablösung des Alt-Systems',
  valuable: '3: Neu, aber sehr sinnvoll',
  requested: '4: Neu und gewünscht',
  funded_optional: '5: Nicht so wichtig, aber finanziert',
  unfunded_nice_to_have: '6: Nice to have, noch ohne Finanzierung',
  irrelevant: '7: Irrelevant',
} as const;

export type ProjectStatus = keyof typeof projectStatusModel;
export type ProjectHealth = (typeof projectHealthModel)[number];
export type ProjectPriority = keyof typeof projectPriorityModel;
export type ProjectStatusMeta = Readonly<{
  version: string;
  updatedAt: string;
  source: string;
}>;
export type ProjectStatusMilestone = Readonly<{
  id: string;
  title: string;
  plannedEffortPt: number;
  sortOrder: number;
  workPackages: readonly ProjectStatusWorkPackage[];
}>;
export type ProjectStatusWorkPackage = Readonly<{
  id: string;
  title: string;
  area: string;
  priority: ProjectPriority;
  effortPt: number;
  status: ProjectStatus;
  health: ProjectHealth;
  dependsOn: readonly string[];
  notes?: string;
}>;
export type ProjectStatusReportContract = Readonly<{
  meta: ProjectStatusMeta;
  statusModel: Readonly<Record<ProjectStatus, number>>;
  healthModel: readonly ProjectHealth[];
  priorityModel: Readonly<Record<ProjectPriority, string>>;
  milestones: readonly ProjectStatusMilestone[];
}>;

type JsonRecord = Record<string, unknown>;

const statusEntries = Object.entries(projectStatusModel) as [ProjectStatus, number][];
const healthEntries = [...projectHealthModel];
const priorityEntries = Object.entries(projectPriorityModel) as [ProjectPriority, string][];

const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const hasExactEntries = <TKey extends string, TValue>(
  value: unknown,
  expectedEntries: readonly [TKey, TValue][],
  matchesValue: (candidate: unknown, expected: TValue) => boolean
): value is Record<TKey, TValue> => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== expectedEntries.length) {
    return false;
  }

  return expectedEntries.every(([expectedKey, expectedValue]) => matchesValue(value[expectedKey], expectedValue));
};

const validateMeta = (meta: unknown, errors: string[]): void => {
  if (!isRecord(meta)) {
    errors.push('meta must be an object');
    return;
  }

  if (typeof meta.version !== 'string' || meta.version.length === 0) {
    errors.push('meta.version must be a non-empty string');
  }

  if (typeof meta.updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(meta.updatedAt)) {
    errors.push('meta.updatedAt must be a YYYY-MM-DD string');
  }

  if (typeof meta.source !== 'string' || meta.source.length === 0) {
    errors.push('meta.source must be a non-empty string');
  }
};

const validateMilestones = (milestones: unknown, errors: string[]): void => {
  const milestoneIds = new Set<string>();
  const workPackageIds = new Set<string>();

  if (!Array.isArray(milestones)) {
    errors.push('milestones must be an array');
    return;
  }

  milestones.forEach((milestone, index) => {
    if (!isRecord(milestone)) {
      errors.push(`milestones[${index}] must be an object`);
      return;
    }

    if (typeof milestone.id !== 'string' || milestone.id.length === 0) {
      errors.push(`milestones[${index}].id must be a non-empty string`);
    } else if (milestoneIds.has(milestone.id)) {
      errors.push(`milestones[${index}].id must be unique`);
    } else {
      milestoneIds.add(milestone.id);
    }

    if (typeof milestone.title !== 'string' || milestone.title.length === 0) {
      errors.push(`milestones[${index}].title must be a non-empty string`);
    }

    if (!isFiniteNumber(milestone.plannedEffortPt) || milestone.plannedEffortPt < 0) {
      errors.push(`milestones[${index}].plannedEffortPt must be a non-negative number`);
    }

    const sortOrder = milestone.sortOrder;
    if (typeof sortOrder !== 'number' || !Number.isInteger(sortOrder) || sortOrder < 1) {
      errors.push(`milestones[${index}].sortOrder must be a positive integer`);
    }

    validateWorkPackages(milestone.workPackages, workPackageIds, errors, `milestones[${index}].workPackages`);
  });

};

const validateWorkPackages = (
  workPackages: unknown,
  knownWorkPackageIds: Set<string>,
  errors: string[],
  path: string
): void => {
  if (!Array.isArray(workPackages)) {
    errors.push(`${path} must be an array`);
    return;
  }

  workPackages.forEach((workPackage, index) => {
    const itemPath = `${path}[${index}]`;

    if (!isRecord(workPackage)) {
      errors.push(`${itemPath} must be an object`);
      return;
    }

    if (typeof workPackage.id !== 'string' || workPackage.id.length === 0) {
      errors.push(`${itemPath}.id must be a non-empty string`);
    } else if (knownWorkPackageIds.has(workPackage.id)) {
      errors.push(`${itemPath}.id must be unique`);
    } else {
      knownWorkPackageIds.add(workPackage.id);
    }

    if (typeof workPackage.title !== 'string' || workPackage.title.length === 0) {
      errors.push(`${itemPath}.title must be a non-empty string`);
    }

    if (typeof workPackage.area !== 'string' || workPackage.area.length === 0) {
      errors.push(`${itemPath}.area must be a non-empty string`);
    }

    if (typeof workPackage.priority !== 'string' || !(workPackage.priority in projectPriorityModel)) {
      errors.push(`${itemPath}.priority must use a known public priority key`);
    }

    if (!isFiniteNumber(workPackage.effortPt) || workPackage.effortPt < 0) {
      errors.push(`${itemPath}.effortPt must be a non-negative number`);
    }

    if (typeof workPackage.status !== 'string' || !(workPackage.status in projectStatusModel)) {
      errors.push(`${itemPath}.status must use a known public status key`);
    }

    if (typeof workPackage.health !== 'string' || !projectHealthModel.includes(workPackage.health as ProjectHealth)) {
      errors.push(`${itemPath}.health must use a known public health key`);
    }

    if (!isStringArray(workPackage.dependsOn)) {
      errors.push(`${itemPath}.dependsOn must be an array of work package ids`);
    }

    if ('notes' in workPackage && typeof workPackage.notes !== 'string') {
      errors.push(`${itemPath}.notes must be a string when provided`);
    }
  });
};

export const validateProjectStatusReport = (value: unknown): string[] => {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return ['project status report must be an object'];
  }

  validateMeta(value.meta, errors);

  if (
    !hasExactEntries(value.statusModel, statusEntries, (candidate, expected) => candidate === expected)
  ) {
    errors.push('statusModel must exactly match the approved public progress mapping');
  }

  const healthModel = value.healthModel;
  if (!Array.isArray(healthModel) || healthModel.length !== healthEntries.length) {
    errors.push('healthModel must exactly match the approved public health mapping');
  } else if (!healthEntries.every((entry, index) => healthModel[index] === entry)) {
    errors.push('healthModel must exactly match the approved public health mapping');
  }

  if (
    !hasExactEntries(value.priorityModel, priorityEntries, (candidate, expected) => candidate === expected)
  ) {
    errors.push('priorityModel must exactly match the approved public priority mapping');
  }

  validateMilestones(value.milestones, errors);

  return errors;
};
