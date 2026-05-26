process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { describe, it, expect, beforeAll } from 'bun:test';
import * as k8s from '@kubernetes/client-node';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CLUSTER_NAME, KUBECONFIGS_DIR } from './scripts/helpers';

const KUBECONFIG_PATH = join(KUBECONFIGS_DIR, 'full-access.yaml');

let core: InstanceType<typeof k8s.CoreV1Api>;
let apps: InstanceType<typeof k8s.AppsV1Api>;
let batch: InstanceType<typeof k8s.BatchV1Api>;
let networking: InstanceType<typeof k8s.NetworkingV1Api>;

beforeAll(() => {
  if (!existsSync(KUBECONFIG_PATH)) {
    throw new Error(
      `Kubeconfig not found at ${KUBECONFIG_PATH}. Run 'bun run cluster:up' first.`,
    );
  }

  const kc = new k8s.KubeConfig();
  kc.loadFromFile(KUBECONFIG_PATH);

  core = kc.makeApiClient(k8s.CoreV1Api);
  apps = kc.makeApiClient(k8s.AppsV1Api);
  batch = kc.makeApiClient(k8s.BatchV1Api);
  networking = kc.makeApiClient(k8s.NetworkingV1Api);
});

describe('namespaces', () => {
  it('has team-api, team-billing, and team-infra', async () => {
    const { items } = await core.listNamespace();
    const names = items.map((ns) => ns.metadata!.name);
    expect(names).toContain('team-api');
    expect(names).toContain('team-billing');
    expect(names).toContain('team-infra');
  });
});

describe('team-api', () => {
  it('has pods in multiple phases', async () => {
    const { items } = await core.listNamespacedPod({ namespace: 'team-api' });
    const phases = new Set(items.map((p) => p.status?.phase));
    expect(phases.size).toBeGreaterThanOrEqual(2);
  });

  it('has deployments with replicas', async () => {
    const { items } = await apps.listNamespacedDeployment({ namespace: 'team-api' });
    expect(items.length).toBeGreaterThanOrEqual(2);
    const gateway = items.find((d) => d.metadata!.name === 'gateway');
    expect(gateway?.spec?.replicas).toBe(3);
  });

  it('has services', async () => {
    const { items } = await core.listNamespacedService({ namespace: 'team-api' });
    const names = items.map((s) => s.metadata!.name);
    expect(names).toContain('gateway');
    expect(names).toContain('user-service');
  });

  it('has configmap and secret', async () => {
    const configmap = await core.readNamespacedConfigMap({ name: 'api-config', namespace: 'team-api' });
    expect(configmap.data?.['LOG_LEVEL']).toBe('info');

    const secret = await core.readNamespacedSecret({ name: 'api-credentials', namespace: 'team-api' });
    expect(secret.data).toBeDefined();
  });

  it('has a completed job', async () => {
    const job = await batch.readNamespacedJob({ name: 'db-migrate', namespace: 'team-api' });
    expect(job.status?.succeeded ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('has a suspended cronjob', async () => {
    const cj = await batch.readNamespacedCronJob({ name: 'report-generator', namespace: 'team-api' });
    expect(cj.spec?.suspend).toBe(true);
  });

  it('has an ingress', async () => {
    const ingress = await networking.readNamespacedIngress({ name: 'api-ingress', namespace: 'team-api' });
    expect(ingress.spec?.rules?.[0]?.host).toBe('api.knals.local');
  });
});

describe('team-billing', () => {
  it('has deployments and services', async () => {
    const { items } = await apps.listNamespacedDeployment({ namespace: 'team-billing' });
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('has a completed job', async () => {
    const job = await batch.readNamespacedJob({ name: 'monthly-reconciliation', namespace: 'team-billing' });
    expect(job.status?.succeeded ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe('team-infra', () => {
  it('has deployments and services', async () => {
    const { items } = await apps.listNamespacedDeployment({ namespace: 'team-infra' });
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('has a completed job', async () => {
    const job = await batch.readNamespacedJob({ name: 'cleanup-old-metrics', namespace: 'team-infra' });
    expect(job.status?.succeeded ?? 0).toBeGreaterThanOrEqual(1);
  });
});
