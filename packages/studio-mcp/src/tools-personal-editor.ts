/** Registers the concrete editorial-profile action using the existing personal transport. */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  editorBaselineInput,
  ensureEditorRoles,
  type PersonalCaller,
} from './editor-role-baseline.js';
import { normalizeError } from './errors.js';
import type { PersonalMcpContextManager } from './personal-auth.js';
import { result } from './tools-support.js';

export const registerPersonalEditorTool = (
  server: McpServer,
  manager: PersonalMcpContextManager,
  call: PersonalCaller
): void => {
  server.registerTool(
    'studio_personal_editor_roles_ensure',
    {
      title: 'Redaktionsprofil für ausgewählte Tenants einrichten',
      description:
        'Legt ausschließlich fehlende Redaktionsrollen über bestehende IAM-APIs an und liest sie zurück. Bestehende Rollen werden nur verglichen; keine Mitgliedschaften werden geändert. Unterstützt News, Veranstaltungen und POI organisationsbezogen, Medien und Kategorien instanzweit. Weitere Inhaltsrechte bleiben ausdrücklich unberücksichtigt.',
      inputSchema: editorBaselineInput.shape,
      outputSchema: {
        ok: z.boolean(),
        data: z.unknown().optional(),
        error: z.unknown().optional(),
        meta: z.record(z.string(), z.unknown()),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (raw) => {
      try {
        const input = editorBaselineInput.parse(raw);
        const contexts = input.contextIds.map((id) => manager.getContext(id));
        const data = await ensureEditorRoles(input, contexts, call);
        const ok = data.every(
          (item) =>
            item.status === 'created' || (item.status === 'existing' && item.matchesStandard)
        );
        return result({ ok, data, meta: {} }, !ok);
      } catch (error) {
        return result({ ok: false, error: normalizeError(error), meta: {} }, true);
      }
    }
  );
};
