export type ReportView = 'milestones' | 'work-packages';

export type ReportFilterState = Readonly<{
  view: ReportView;
  milestone: string;
  status: string;
  health: string;
  priority: string;
  q: string;
}>;

export const defaultReportFilterState: ReportFilterState = {
  view: 'milestones',
  milestone: 'all',
  status: 'all',
  health: 'all',
  priority: 'all',
  q: '',
};

const allowedViews = new Set<ReportView>(['milestones', 'work-packages']);
const allowedStatuses = new Set([
  'all',
  'idea',
  'commissioned',
  'planned',
  'prototype',
  'implementation',
  'optimization',
  'testing',
  'acceptance',
  'done',
]);
const allowedHealthStates = new Set(['all', 'on_track', 'needs_attention', 'at_risk', 'blocked']);
const allowedPriorities = new Set([
  'all',
  'must',
  'replacement_required',
  'valuable',
  'requested',
  'funded_optional',
  'unfunded_nice_to_have',
  'irrelevant',
]);

export const parseFilterStateFromSearchParams = (searchParams: URLSearchParams): ReportFilterState => ({
  view: allowedViews.has(searchParams.get('view') as ReportView)
    ? (searchParams.get('view') as ReportView)
    : defaultReportFilterState.view,
  milestone: searchParams.get('milestone') || defaultReportFilterState.milestone,
  status: allowedStatuses.has(searchParams.get('status') ?? '')
    ? (searchParams.get('status') as string)
    : defaultReportFilterState.status,
  health: allowedHealthStates.has(searchParams.get('health') ?? '')
    ? (searchParams.get('health') as string)
    : defaultReportFilterState.health,
  priority: allowedPriorities.has(searchParams.get('priority') ?? '')
    ? (searchParams.get('priority') as string)
    : defaultReportFilterState.priority,
  q: searchParams.get('q') || defaultReportFilterState.q,
});

export const stringifyFilterStateToSearchParams = (state: ReportFilterState): URLSearchParams => {
  const params = new URLSearchParams();

  if (state.view !== defaultReportFilterState.view) {
    params.set('view', state.view);
  }
  if (state.milestone !== defaultReportFilterState.milestone) {
    params.set('milestone', state.milestone);
  }
  if (state.status !== defaultReportFilterState.status) {
    params.set('status', state.status);
  }
  if (state.health !== defaultReportFilterState.health) {
    params.set('health', state.health);
  }
  if (state.priority !== defaultReportFilterState.priority) {
    params.set('priority', state.priority);
  }
  if (state.q.trim().length > 0) {
    params.set('q', state.q.trim());
  }

  return params;
};
