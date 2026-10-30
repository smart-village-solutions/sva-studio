import { beforeEach, expect, it, vi } from 'vitest';
const read=vi.hoisted(()=>vi.fn());
vi.mock('../iam-instance-registry/mail-template-sync.js',()=>({readMailTemplate:read}));
import { ensureAccountInvitationRealmValues } from './account-invitation-guard';
beforeEach(()=>vi.resetAllMocks());
it('allows only a freshly compared synchronized template',async()=>{read.mockResolvedValue({status:'synced'});await ensureAccountInvitationRealmValues({instanceId:'demo'});expect(read).toHaveBeenCalledWith('demo','invitation');});
it.each(['pending','unreviewed','failed','drift'])('blocks %s without any repair writes',async(status)=>{read.mockResolvedValue({status});await expect(ensureAccountInvitationRealmValues({instanceId:'demo'})).rejects.toMatchObject({code:'account_invitation_template_drift',statusCode:409,retryable:false});});
it('blocks if the current comparison fails',async()=>{read.mockRejectedValue(new Error());await expect(ensureAccountInvitationRealmValues({instanceId:'demo'})).rejects.toMatchObject({code:'account_invitation_template_drift'});});
