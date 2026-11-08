/** Public HTTPS requests with IP validation in the socket's DNS lookup, without redirects. */
import { lookup } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';

import ipaddr from 'ipaddr.js';
import { Agent, fetch as undiciFetch } from 'undici';

const rejectedTarget = () => new Error('public_https_target_rejected');
const unbracket = (hostname: string) => hostname.replace(/^\[|\]$/g, '');

const isPublicAddress = (address: string): boolean => {
  try {
    // process() converts mapped IPv6 to IPv4 before classifying its range.
    const parsed = ipaddr.process(address);
    if (parsed.range() !== 'unicast') return false;
    const [first, second, third] = parsed.toByteArray();
    // Exclude benchmark IPv4 and restrict IPv6 to global unicast (2000::/3).
    // The installed ipaddr version classifies site-local and NAT64 prefixes as unicast.
    return parsed.kind() === 'ipv4'
      ? !(first === 198 && (second === 18 || second === 19))
      : first >= 0x20 && first <= 0x3f &&
        // Special-purpose protocol assignments (2001::/23) and documentation (3fff::/20).
        !(first === 0x20 && second === 0x01 && third < 2) &&
        !(first === 0x3f && second === 0xff && third < 0x10);
  } catch {
    return false;
  }
};

const publicLookup: LookupFunction = (hostname, options, callback) => {
  // Resolve once per connection. The socket receives exactly the checked answers.
  void lookup(hostname, { ...options, all: true }).then((addresses) => {
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
      callback(rejectedTarget(), '');
      return;
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  }, (error: NodeJS.ErrnoException) => callback(error, ''));
};

const dispatcher = new Agent({ connect: { lookup: publicLookup } });

const isPrivateHostname = (hostname: string): boolean =>
  hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
  (isIP(hostname) !== 0 && !isPublicAddress(hostname));

const fetchCheckedDestination = async (
  input: string | URL,
  init: RequestInit,
  policy: { allowHttp: boolean; allowPrivateHosts: boolean }
): Promise<Response> => {
  const url = new URL(input);
  const hostname = unbracket(url.hostname).toLowerCase();
  if (
    (url.protocol !== 'https:' && !(policy.allowHttp && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    (!policy.allowPrivateHosts && isPrivateHostname(hostname)) ||
    (init.redirect !== undefined && init.redirect !== 'error' && init.redirect !== 'manual')
  )
    throw rejectedTarget();
  // Explicit private mode uses Undici's ordinary resolver; the public mode binds checked DNS to the socket.
  return undiciFetch(url, {
    ...init,
    redirect: init.redirect ?? 'error',
    ...(policy.allowPrivateHosts ? {} : { dispatcher }),
  } as Parameters<typeof undiciFetch>[1]) as unknown as Promise<Response>;
};

/** Fetch a public HTTPS destination; caller owns timeout and response-body limits. */
export const fetchPublicHttps = (input: string | URL, init: RequestInit = {}): Promise<Response> =>
  fetchCheckedDestination(input, init, { allowHttp: false, allowPrivateHosts: false });

/** Geocoding supports HTTP and an explicit server-owned private-network opt-in. Redirects remain manual. */
export const fetchMapGeocoding = (
  input: string | URL,
  init: RequestInit = {},
  policy: { allowPrivateHosts: boolean } = { allowPrivateHosts: false },
): Promise<Response> => fetchCheckedDestination(input, { redirect: 'manual', ...init }, {
  allowHttp: true,
  allowPrivateHosts: policy.allowPrivateHosts,
});
