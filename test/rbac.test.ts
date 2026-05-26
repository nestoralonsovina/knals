process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { describe, it, expect, beforeAll } from 'bun:test';
import * as k8s from '@kubernetes/client-node';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { KUBECONFIGS_DIR, PERSONAS } from './scripts/helpers';

function loadPersona(name: string): k8s.KubeConfig {
  const path = join(KUBECONFIGS_DIR, `${name}.yaml`);
  if (!existsSync(path)) {
    throw new Error(`Kubeconfig not found: ${path}. Run 'bun run cluster:up' first.`);
  }
  const kc = new k8s.KubeConfig();
  kc.loadFromFile(path);
  return kc;
}

async function canList(
  core: InstanceType<typeof k8s.CoreV1Api>,
  resource: 'pods' | 'secrets' | 'configmaps' | 'services',
  namespace: string,
): Promise<boolean> {
  try {
    switch (resource) {
      case 'pods':
        await core.listNamespacedPod({ namespace });
        break;
      case 'secrets':
        await core.listNamespacedSecret({ namespace });
        break;
      case 'configmaps':
        await core.listNamespacedConfigMap({ namespace });
        break;
      case 'services':
        await core.listNamespacedService({ namespace });
        break;
    }
    return true;
  } catch {
    return false;
  }
}

async function canListNamespaces(
  core: InstanceType<typeof k8s.CoreV1Api>,
): Promise<boolean> {
  try {
    await core.listNamespace();
    return true;
  } catch {
    return false;
  }
}

async function canDelete(
  core: InstanceType<typeof k8s.CoreV1Api>,
  namespace: string,
): Promise<boolean> {
  try {
    // Try to delete a non-existent configmap — a 404 means we have permission,
    // a 403 means we don't
    await core.deleteNamespacedConfigMap({ name: 'nonexistent-test-probe', namespace });
    return true;
  } catch (e: any) {
    if (e?.code === 404 || e?.body?.code === 404) return true;
    if (e?.code === 403 || e?.body?.code === 403) return false;
    return false;
  }
}

describe('kubeconfigs', () => {
  it('exist for all personas', () => {
    for (const persona of PERSONAS) {
      const path = join(KUBECONFIGS_DIR, `${persona}.yaml`);
      expect(existsSync(path)).toBe(true);
    }
  });
});

describe('namespace-only persona', () => {
  let core: InstanceType<typeof k8s.CoreV1Api>;

  beforeAll(() => {
    core = loadPersona('namespace-only').makeApiClient(k8s.CoreV1Api);
  });

  it('can list pods in team-api', async () => {
    expect(await canList(core, 'pods', 'team-api')).toBe(true);
  });

  it('can list pods in team-infra', async () => {
    expect(await canList(core, 'pods', 'team-infra')).toBe(true);
  });

  it('CANNOT list namespaces at cluster scope', async () => {
    expect(await canListNamespaces(core)).toBe(false);
  });

  it('CANNOT list pods in team-billing', async () => {
    expect(await canList(core, 'pods', 'team-billing')).toBe(false);
  });
});

describe('read-only persona', () => {
  let core: InstanceType<typeof k8s.CoreV1Api>;

  beforeAll(() => {
    core = loadPersona('read-only').makeApiClient(k8s.CoreV1Api);
  });

  it('can list pods in team-api', async () => {
    expect(await canList(core, 'pods', 'team-api')).toBe(true);
  });

  it('can list secrets in team-api', async () => {
    expect(await canList(core, 'secrets', 'team-api')).toBe(true);
  });

  it('can list services in team-api', async () => {
    expect(await canList(core, 'services', 'team-api')).toBe(true);
  });

  it('CANNOT delete in team-api', async () => {
    expect(await canDelete(core, 'team-api')).toBe(false);
  });

  it('CANNOT list pods in team-billing', async () => {
    expect(await canList(core, 'pods', 'team-billing')).toBe(false);
  });

  it('CANNOT list namespaces at cluster scope', async () => {
    expect(await canListNamespaces(core)).toBe(false);
  });
});

describe('mixed-permissions persona', () => {
  let core: InstanceType<typeof k8s.CoreV1Api>;

  beforeAll(() => {
    core = loadPersona('mixed-permissions').makeApiClient(k8s.CoreV1Api);
  });

  it('can list pods in team-api', async () => {
    expect(await canList(core, 'pods', 'team-api')).toBe(true);
  });

  it('can list configmaps in team-api', async () => {
    expect(await canList(core, 'configmaps', 'team-api')).toBe(true);
  });

  it('CANNOT list secrets in team-api', async () => {
    expect(await canList(core, 'secrets', 'team-api')).toBe(false);
  });

  it('can list pods in team-billing', async () => {
    expect(await canList(core, 'pods', 'team-billing')).toBe(true);
  });

  it('CANNOT list secrets in team-billing', async () => {
    expect(await canList(core, 'secrets', 'team-billing')).toBe(false);
  });

  it('CANNOT access team-infra at all', async () => {
    expect(await canList(core, 'pods', 'team-infra')).toBe(false);
  });

  it('CANNOT list namespaces at cluster scope', async () => {
    expect(await canListNamespaces(core)).toBe(false);
  });
});

describe('SelfSubjectRulesReview', () => {
  it('returns meaningful results per persona', async () => {
    const fullKc = loadPersona('full-access');
    const authApi = fullKc.makeApiClient(k8s.AuthorizationV1Api);

    const review = await authApi.createSelfSubjectRulesReview({
      body: {
        apiVersion: 'authorization.k8s.io/v1',
        kind: 'SelfSubjectRulesReview',
        spec: { namespace: 'team-api' },
      },
    });

    expect(review.status?.resourceRules).toBeDefined();
    expect(review.status!.resourceRules!.length).toBeGreaterThan(0);
  });
});
