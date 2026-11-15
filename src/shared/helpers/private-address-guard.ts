import dns from 'node:dns';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';

const blockedAddresses = new BlockList();
blockedAddresses.addSubnet('0.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('10.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('127.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('169.254.0.0', 16, 'ipv4');
blockedAddresses.addSubnet('172.16.0.0', 12, 'ipv4');
blockedAddresses.addSubnet('192.168.0.0', 16, 'ipv4');
// Tailscale hands out tailnet addresses from the CGNAT range, and the API runs on a tailnet host.
blockedAddresses.addSubnet('100.64.0.0', 10, 'ipv4');
// Alibaba Cloud metadata endpoint.
blockedAddresses.addAddress('100.100.100.200', 'ipv4');
blockedAddresses.addAddress('::', 'ipv6');
blockedAddresses.addAddress('::1', 'ipv6');
blockedAddresses.addSubnet('fc00::', 7, 'ipv6');
blockedAddresses.addSubnet('fe80::', 10, 'ipv6');

/**
 * Accepts a bare IP or a bracketed IPv6 hostname as `URL.hostname` returns it.
 * Domain names return false: resolve them first. IPv4-mapped IPv6 addresses
 * are checked against the IPv4 ranges by `BlockList` itself.
 */
export function isBlockedIpAddress(address: string): boolean {
  const bare = address.replace(/^\[(.*)\]$/, '$1');
  const version = isIP(bare);
  if (version === 0) {
    return false;
  }
  return blockedAddresses.check(bare, version === 4 ? 'ipv4' : 'ipv6');
}

type IsBlocked = (address: string) => boolean;

// The agent always passes a callback, and Node documents `callback(err)` for a
// failed connection, but @types/node types it as optional with a required stream.
type ConnectionErrorCallback = (error: Error) => void;

function blockedAddressError(host: string, address: string): Error {
  return new Error(
    `Refusing to connect to ${host}: ${address} is a blocked address`,
  );
}

function guardedLookup(isBlocked: IsBlocked): LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error, '');
        return;
      }
      // Refuse if any answer is blocked, since the socket may pick any of them.
      const blocked = addresses.find(({ address }) => isBlocked(address));
      if (blocked) {
        callback(blockedAddressError(hostname, blocked.address), '');
        return;
      }
      if (options.all) {
        callback(null, addresses);
        return;
      }
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

function guardAgent<T extends HttpAgent>(agent: T, isBlocked: IsBlocked): T {
  const lookup = guardedLookup(isBlocked);
  // strictBindCallApply is off in this repo, so bind() returns any.
  const createConnection = agent.createConnection.bind(
    agent,
  ) as HttpAgent['createConnection'];
  agent.createConnection = (options, callback) => {
    // Node never calls `lookup` for an IP literal host, so check it here.
    if (options.host && isBlocked(options.host)) {
      (callback as ConnectionErrorCallback)(
        blockedAddressError(options.host, options.host),
      );
      return undefined;
    }
    return createConnection({ ...options, lookup }, callback);
  };
  return agent;
}

/**
 * Agents for axios that refuse to connect to a blocked address, on every
 * redirect hop and at the address the socket actually uses, so a DNS answer
 * that changes between a check and the fetch cannot slip through.
 * Spread the result into the axios request config.
 */
export function createGuardedAgents(isBlocked: IsBlocked = isBlockedIpAddress) {
  return {
    httpAgent: guardAgent(new HttpAgent(), isBlocked),
    httpsAgent: guardAgent(new HttpsAgent(), isBlocked),
  };
}

/** For every fetch of a URL the owner did not write: user submissions and links inside feeds. */
export const guardedAgents = createGuardedAgents();
