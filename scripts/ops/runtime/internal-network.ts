const INTERNAL_NETWORK_EXCLUSIONS = new Set(['public', 'network-node-005']);

export const pickInternalNetworkName = (networkNames: readonly string[] | undefined): string | undefined =>
  networkNames
    ?.map((networkName) => networkName.trim())
    .find((networkName) => networkName.length > 0 && !INTERNAL_NETWORK_EXCLUSIONS.has(networkName));
