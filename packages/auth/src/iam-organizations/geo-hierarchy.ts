import type { IamGeoHierarchyEntry, IamGeoNode, IamGeoNodeType } from '@sva/core';

import type { QueryClient } from '../shared/db-helpers.js';
import { withInstanceScopedDb } from '../iam-account-management/shared.js';

type GeoNodeRow = {
  id: string;
  instance_id: string;
  key: string;
  display_name: string;
  node_type: string;
};

type GeoHierarchyRow = {
  ancestor_id: string;
  descendant_id: string;
  depth: number;
};

const mapGeoNode = (row: GeoNodeRow): IamGeoNode => ({
  id: row.id,
  instanceId: row.instance_id,
  key: row.key,
  displayName: row.display_name,
  nodeType: row.node_type as IamGeoNodeType,
});

// ---------------------------------------------------------------------------
// Public read interface
// ---------------------------------------------------------------------------

/**
 * Liefert alle Vorfahren eines Geo-Knotens (inkl. sich selbst, depth=0) aus dem Closure-Table.
 * Die Rückgabe ist aufsteigend nach depth sortiert (direkter Elternknoten zuerst).
 */
export const getGeoAncestors = async (
  instanceId: string,
  descendantId: string
): Promise<IamGeoHierarchyEntry[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<GeoHierarchyRow>(
      `
SELECT ancestor_id, descendant_id, depth
FROM iam.geo_hierarchy
WHERE descendant_id = $1::uuid
ORDER BY depth ASC;
`,
      [descendantId]
    );
    return result.rows.map((r) => ({
      ancestorId: r.ancestor_id,
      descendantId: r.descendant_id,
      depth: r.depth,
    }));
  });

/**
 * Liefert alle Nachfahren eines Geo-Knotens (inkl. sich selbst, depth=0) aus dem Closure-Table.
 */
export const getGeoDescendants = async (
  instanceId: string,
  ancestorId: string
): Promise<IamGeoHierarchyEntry[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<GeoHierarchyRow>(
      `
SELECT ancestor_id, descendant_id, depth
FROM iam.geo_hierarchy
WHERE ancestor_id = $1::uuid
ORDER BY depth ASC;
`,
      [ancestorId]
    );
    return result.rows.map((r) => ({
      ancestorId: r.ancestor_id,
      descendantId: r.descendant_id,
      depth: r.depth,
    }));
  });

/**
 * Lädt mehrere Geo-Knoten per IDs.
 * Ignoriert gelöschte Knoten (deleted_at IS NOT NULL).
 */
export const getGeoNodes = async (instanceId: string, nodeIds: string[]): Promise<IamGeoNode[]> => {
  if (nodeIds.length === 0) return [];
  return withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<GeoNodeRow>(
      `
SELECT id, instance_id, key, display_name, node_type
FROM iam.geo_nodes
WHERE instance_id = $1
  AND id = ANY($2::uuid[])
  AND deleted_at IS NULL;
`,
      [instanceId, nodeIds]
    );
    return result.rows.map(mapGeoNode);
  });
};

/**
 * Lädt alle aktiven Geo-Knoten einer Instanz.
 */
export const listGeoNodes = async (instanceId: string): Promise<IamGeoNode[]> =>
  withInstanceScopedDb(instanceId, async (client) => {
    const result = await client.query<GeoNodeRow>(
      `
SELECT id, instance_id, key, display_name, node_type
FROM iam.geo_nodes
WHERE instance_id = $1
  AND deleted_at IS NULL
ORDER BY display_name ASC;
`,
      [instanceId]
    );
    return result.rows.map(mapGeoNode);
  });

/**
 * Prüft, ob ein Geo-Knoten ein Vorfahre eines anderen ist (für den Permission-Engine).
 * Wird intern von der Authorization-Engine verwendet, um Geo-Scope-Checks durchzuführen.
 */
export const isGeoAncestorOf = async (
  client: QueryClient,
  input: { ancestorId: string; descendantId: string }
): Promise<boolean> => {
  const result = await client.query<{ exists: boolean }>(
    `
SELECT EXISTS (
  SELECT 1
  FROM iam.geo_hierarchy
  WHERE ancestor_id = $1::uuid
    AND descendant_id = $2::uuid
) AS exists;
`,
    [input.ancestorId, input.descendantId]
  );
  return Boolean(result.rows[0]?.exists);
};

/**
 * Liefert die tiefste Hierarchietiefe zwischen zwei Knoten (0 = identisch, -1 = kein Pfad).
 */
export const getGeoDepth = async (
  client: QueryClient,
  input: { ancestorId: string; descendantId: string }
): Promise<number> => {
  const result = await client.query<{ depth: number | null }>(
    `
SELECT depth
FROM iam.geo_hierarchy
WHERE ancestor_id = $1::uuid
  AND descendant_id = $2::uuid
LIMIT 1;
`,
    [input.ancestorId, input.descendantId]
  );
  return result.rows[0]?.depth ?? -1;
};
