// fallow-ignore-file code-duplication
import type { IamContentHistoryEntry, IamContentStatus } from '@sva/plugin-sdk';

const surveyHistoryActionLabelKeys = {
  created: 'history.actions.created',
  updated: 'history.actions.updated',
  status_changed: 'history.actions.statusChanged',
} as const satisfies Record<IamContentHistoryEntry['action'], string>;

export type SurveyHistoryEntry = Readonly<{
  id: string;
  action: IamContentHistoryEntry['action'];
  actionLabelKey: (typeof surveyHistoryActionLabelKeys)[IamContentHistoryEntry['action']];
  actor: string;
  changedFields: readonly string[];
  createdAt: string;
  summary?: string;
  fromStatus?: IamContentStatus;
  toStatus?: IamContentStatus;
}>;

const byDescendingCreatedAt = (left: IamContentHistoryEntry, right: IamContentHistoryEntry) =>
  right.createdAt.localeCompare(left.createdAt);

export const createSurveyHistoryEntries = (
  entries: readonly IamContentHistoryEntry[]
): readonly SurveyHistoryEntry[] =>
  [...entries].sort(byDescendingCreatedAt).map((entry) => ({
    id: entry.id,
    action: entry.action,
    actionLabelKey: surveyHistoryActionLabelKeys[entry.action],
    actor: entry.actor,
    changedFields: entry.changedFields,
    createdAt: entry.createdAt,
    summary: entry.summary,
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
  }));
