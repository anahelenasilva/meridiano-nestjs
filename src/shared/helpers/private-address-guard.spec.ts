import axios from 'axios';
import dns from 'node:dns';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  createGuardedAgents,
  isBlockedIpAddress,
} from './private-address-guard';

describe('isBlockedIpAddress', () => {
  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '100.64.0.1',
    '100.127.255.255',
    '100.100.100.200',
    '::',
    '::1',
    '[::1]',
    'fd00:ec2::254',
    'fe80::1',
    '::ffff:127.0.0.1',
    '[::ffff:7f00:1]',
  ])('blocks %s', (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '172.32.0.1',
    '100.128.0.1',
    '2606:4700:4700::1111',
    '[2606:4700:4700::1111]',
    'example.com',
  ])('allows %s', (address) => {
    expect(isBlockedIpAddress(address)).toBe(false);
  });
});

describe('createGuardedAgents', () => {
  // The production policy blocks loopback, where the test server lives, so
  // these tests block only the metadata address and fake one DNS name for it.
  const metadataAddress = '169.254.169.254';
  const agents = createGuardedAgents((address) => address === metadataAddress);
  const realLookup = dns.lookup;
  let server: Server;
  let origin: string;
  let requestedPaths: string[];

  function get(url: string) {
    return axios.get<string>(url, { ...agents, timeout: 2000 });
  }

  beforeAll(async () => {
    server = createServer((request, response) => {
      requestedPaths.push(request.url ?? '');
      const location = new URL(request.url ?? '/', 'http://x').searchParams.get(
        'to',
      );
      if (location) {
        response.writeHead(302, { location }).end();
        return;
      }
      response.end('article body');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    origin = `http://localhost:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    requestedPaths = [];
    jest.spyOn(dns, 'lookup').mockImplementation(((
      hostname: string,
      options: dns.LookupOptions,
      callback: (...args: unknown[]) => void,
    ) => {
      if (hostname === 'metadata.test') {
        callback(null, [{ address: metadataAddress, family: 4 }]);
        return;
      }
      realLookup(hostname, options, callback);
    }) as typeof dns.lookup);
  });

  afterEach(() => jest.restoreAllMocks());

  it('fetches a URL whose host resolves to an allowed address', async () => {
    const response = await get(`${origin}/post`);

    expect(response.data).toBe('article body');
  });

  it('refuses a host that resolves to a blocked address', async () => {
    await expect(get('http://metadata.test/latest')).rejects.toThrow(
      /blocked address/,
    );
  });

  it('refuses a blocked IP literal without resolving it', async () => {
    await expect(get(`http://${metadataAddress}/latest`)).rejects.toThrow(
      /blocked address/,
    );
  });

  it('refuses a redirect to a blocked IP literal', async () => {
    await expect(
      get(`${origin}/post?to=http://${metadataAddress}/latest`),
    ).rejects.toThrow(/blocked address/);
    expect(requestedPaths).toHaveLength(1);
  });

  it('refuses a redirect to a host that resolves to a blocked address', async () => {
    await expect(
      get(`${origin}/post?to=http://metadata.test/latest`),
    ).rejects.toThrow(/blocked address/);
    expect(requestedPaths).toHaveLength(1);
  });
});
