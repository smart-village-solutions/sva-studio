export const iamContentPrimitiveActions = [
  'content.read',
  'content.create',
  'content.updateMetadata',
  'content.updatePayload',
  'content.transferOwnership',
  'content.changeStatus',
  'content.publish',
  'content.archive',
  'content.restore',
  'content.readHistory',
  'content.manageRevisions',
  'content.delete',
] as const;
export const iamContentDomainCapabilities = [
  'content.create',
  'content.update_metadata',
  'content.update_payload',
  'content.transfer_ownership',
  'content.change_status',
  'content.publish',
  'content.archive',
  'content.restore',
  'content.manage_revisions',
  'content.delete',
] as const;
export type IamContentPrimitiveAction = (typeof iamContentPrimitiveActions)[number];
export type IamContentDomainCapability = (typeof iamContentDomainCapabilities)[number];
export type IamContentCapabilityMappingDiagnosticCode =
  'capability_mapping_missing' | 'capability_mapping_invalid' | 'capability_authorization_denied';
export type IamContentCapabilityMapping = {
  readonly domainCapability: IamContentDomainCapability;
  readonly primitiveAction: string;
};

export type ResolvedIamContentCapabilityMapping =
  | {
      readonly ok: true;
      readonly domainCapability: IamContentDomainCapability;
      readonly primitiveAction: IamContentPrimitiveAction;
    }
  | {
      readonly ok: false;
      readonly reasonCode: Extract<
        IamContentCapabilityMappingDiagnosticCode,
        'capability_mapping_missing' | 'capability_mapping_invalid'
      >;
      readonly domainCapability?: string;
      readonly primitiveAction?: string;
    };
