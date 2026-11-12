/** Page identities and saved-state revisions used by existing SSF editors. */
import { z } from 'zod';

/** Administrative concurrency tokens deliberately exclude the remote language catalogue. */
export const SSF_CONTENT_REVISION_HEADER = 'X-SSF-Content-Revision';
export const SSF_EXPECTED_CONTENT_REVISION_HEADER = 'X-SSF-Expected-Content-Revision';
export const ssfAdminContentRevisionSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
export type SsfVersionedContent<T> = T & { readonly contentRevision: string };

export type SsfTenantEditorPage = 'appearance' | 'languages' | 'recordings' | 'feedback';
export type SsfSystemEditorPage = 'default-configuration' | 'default-content';
