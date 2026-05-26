import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Cluster } from '@knals/sdk';
import {
  SERVER_URL,
  CLUSTER_NAME,
  buildServer,
  startServer,
  stopServer,
} from './scripts/helpers';

beforeAll(async () => {
  await buildServer();
  await startServer();
}, 120_000);

afterAll(() => {
  stopServer();
});

describe('GET /clusters', () => {
  it('returns a JSON array', async () => {
    const resp = await fetch(`${SERVER_URL}/clusters`);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('content-type')).toContain('application/json');

    const clusters: Cluster[] = await resp.json();
    expect(Array.isArray(clusters)).toBe(true);
  });

  it('includes the kind test cluster context', async () => {
    const resp = await fetch(`${SERVER_URL}/clusters`);
    const clusters: Cluster[] = await resp.json();

    const kindCluster = clusters.find((c) => c.name === `kind-${CLUSTER_NAME}`);
    expect(kindCluster).toBeDefined();
    expect(kindCluster!.server).toContain('https://');
    expect(kindCluster!.user).toBeDefined();
    expect(typeof kindCluster!.connected).toBe('boolean');
  });

  it('each cluster has all required fields', async () => {
    const resp = await fetch(`${SERVER_URL}/clusters`);
    const clusters: Cluster[] = await resp.json();

    for (const cluster of clusters) {
      expect(cluster.name).toBeDefined();
      expect(typeof cluster.name).toBe('string');
      expect(cluster.server).toBeDefined();
      expect(typeof cluster.server).toBe('string');
      expect(typeof cluster.connected).toBe('boolean');
    }
  });

  it('marks exactly one cluster as connected', async () => {
    const resp = await fetch(`${SERVER_URL}/clusters`);
    const clusters: Cluster[] = await resp.json();

    const connectedCount = clusters.filter((c) => c.connected).length;
    expect(connectedCount).toBe(1);
  });
});
