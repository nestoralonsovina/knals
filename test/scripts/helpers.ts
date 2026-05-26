// kind clusters use self-signed certs that Bun's TLS stack doesn't trust
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import * as k8s from '@kubernetes/client-node';
import {
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

export const CLUSTER_NAME = 'knals-test';
export const TEST_DIR = resolve(import.meta.dir, '..');
export const MANIFESTS_DIR = join(TEST_DIR, 'manifests');
export const KUBECONFIGS_DIR = join(TEST_DIR, 'kubeconfigs');
const NAMESPACES = ['team-api', 'team-billing', 'team-infra'];

export async function exec(
  cmd: string[],
  opts: { inheritStderr?: boolean } = {},
): Promise<string> {
  const proc = Bun.spawn(cmd, {
    stdout: 'pipe',
    stderr: opts.inheritStderr ? 'inherit' : 'pipe',
  });
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    if (!opts.inheritStderr && proc.stderr) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`${cmd.join(' ')} failed:\n${stderr}`);
    }
    throw new Error(`${cmd.join(' ')} exited with ${exitCode}`);
  }
  return stdout.trim();
}

export async function clusterExists(): Promise<boolean> {
  try {
    const stdout = await exec(['kind', 'get', 'clusters']);
    return stdout.split('\n').includes(CLUSTER_NAME);
  } catch {
    return false;
  }
}

export async function createCluster(): Promise<void> {
  console.log(`Creating kind cluster '${CLUSTER_NAME}'...`);
  await exec(
    ['kind', 'create', 'cluster', '--config', join(TEST_DIR, 'kind-config.yaml')],
    { inheritStderr: true },
  );
}

export async function deleteCluster(): Promise<void> {
  console.log(`Deleting kind cluster '${CLUSTER_NAME}'...`);
  try {
    await exec(['kind', 'delete', 'cluster', '--name', CLUSTER_NAME], {
      inheritStderr: true,
    });
  } catch {
    // cluster might not exist
  }
}

// Bun's node-fetch polyfill doesn't support the `agent` option, which
// @kubernetes/client-node uses for client-certificate auth. Bootstrap a
// full-access SA via kubectl, then build a KubeConfig with token auth.
export async function bootstrapAuth(): Promise<k8s.KubeConfig> {
  const ctx = `kind-${CLUSTER_NAME}`;

  await exec([
    'kubectl', '--context', ctx, 'apply', '-f',
    join(MANIFESTS_DIR, 'rbac', 'full-access.yaml'),
  ]);

  const token = await exec([
    'kubectl', '--context', ctx,
    'create', 'token', 'full-access', '-n', 'default', '--duration=1h',
  ]);

  const server = await exec([
    'kubectl', '--context', ctx,
    'config', 'view', '--minify', '--raw',
    '-o', 'jsonpath={.clusters[0].cluster.server}',
  ]);

  const kc = new k8s.KubeConfig();
  kc.loadFromOptions({
    clusters: [{ name: CLUSTER_NAME, server, skipTLSVerify: true }],
    users: [{ name: 'full-access', token }],
    contexts: [{ name: 'default', cluster: CLUSTER_NAME, user: 'full-access' }],
    currentContext: 'default',
  });

  return kc;
}

function isNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as Record<string, unknown>;
  return (
    (err as any).body?.code === 404 ||
    (err as any).statusCode === 404 ||
    (err as any).response?.statusCode === 404 ||
    (err as any).code === 404
  );
}

export async function applyManifests(
  kc: k8s.KubeConfig,
  ...paths: string[]
): Promise<void> {
  const client = k8s.KubernetesObjectApi.makeApiClient(kc);

  for (const path of paths) {
    const yaml = readFileSync(path, 'utf8');
    const specs = k8s.loadAllYaml(yaml).filter(
      (s: unknown): s is k8s.KubernetesObject =>
        s != null && typeof s === 'object' && 'kind' in (s as object),
    );

    for (const spec of specs) {
      if (!spec.kind || !spec.metadata?.name) continue;
      const label = `${spec.kind}/${spec.metadata.name}`;
      const ns = spec.metadata.namespace
        ? ` -n ${spec.metadata.namespace}`
        : '';

      try {
        const existing = await client.read(spec);
        if (spec.kind === 'Pod' || spec.kind === 'Job') {
          console.log(`  ${label}${ns} unchanged`);
          continue;
        }
        spec.metadata.resourceVersion = existing.metadata?.resourceVersion;
        await client.replace(spec);
        console.log(`  ${label}${ns} configured`);
      } catch (e) {
        if (isNotFound(e)) {
          await client.create(spec);
          console.log(`  ${label}${ns} created`);
        } else {
          throw e;
        }
      }
    }
  }
}

export async function waitForDefaultServiceAccounts(
  kc: k8s.KubeConfig,
): Promise<void> {
  const core = kc.makeApiClient(k8s.CoreV1Api);

  for (const ns of NAMESPACES) {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await core.readNamespacedServiceAccount({ name: 'default', namespace: ns });
        break;
      } catch {
        if (attempt === 59)
          throw new Error(`Timed out waiting for default SA in ${ns}`);
        await Bun.sleep(500);
      }
    }
  }
}

export const PERSONAS = [
  'full-access',
  'namespace-only',
  'read-only',
  'mixed-permissions',
] as const;

export type Persona = (typeof PERSONAS)[number];

async function readTokenSecret(
  core: InstanceType<typeof k8s.CoreV1Api>,
  name: string,
): Promise<{ token: string; ca: string }> {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const secret = await core.readNamespacedSecret({
        name: `${name}-token`,
        namespace: 'default',
      });
      const tokenData = secret.data?.['token'];
      const caData = secret.data?.['ca.crt'];
      if (tokenData && caData) {
        return {
          token: Buffer.from(tokenData, 'base64').toString(),
          ca: caData,
        };
      }
    } catch {
      // secret might not be populated yet
    }
    await Bun.sleep(1000);
  }
  throw new Error(`Timed out waiting for ${name}-token secret`);
}

export async function generateKubeconfigs(kc: k8s.KubeConfig): Promise<void> {
  const core = kc.makeApiClient(k8s.CoreV1Api);
  const cluster = kc.getCurrentCluster();
  if (!cluster) throw new Error('No current cluster');

  mkdirSync(KUBECONFIGS_DIR, { recursive: true });

  for (const persona of PERSONAS) {
    const { token, ca } = await readTokenSecret(core, persona);

    const kubeconfig = [
      'apiVersion: v1',
      'kind: Config',
      'clusters:',
      '  - cluster:',
      `      certificate-authority-data: ${ca}`,
      `      server: ${cluster.server}`,
      `    name: ${CLUSTER_NAME}`,
      'contexts:',
      '  - context:',
      `      cluster: ${CLUSTER_NAME}`,
      `      user: ${persona}`,
      `    name: ${persona}@${CLUSTER_NAME}`,
      `current-context: ${persona}@${CLUSTER_NAME}`,
      'users:',
      `  - name: ${persona}`,
      '    user:',
      `      token: ${token}`,
      '',
    ].join('\n');

    writeFileSync(join(KUBECONFIGS_DIR, `${persona}.yaml`), kubeconfig);
    console.log(`  ${persona}.yaml`);
  }
}

export async function waitForResources(kc: k8s.KubeConfig): Promise<void> {
  const apps = kc.makeApiClient(k8s.AppsV1Api);
  const batch = kc.makeApiClient(k8s.BatchV1Api);

  for (const ns of NAMESPACES) {
    // Wait for all deployments to have available replicas
    for (let attempt = 0; attempt < 120; attempt++) {
      const { items } = await apps.listNamespacedDeployment({ namespace: ns });
      const allReady = items.every(
        (d) => (d.status?.availableReplicas ?? 0) >= (d.spec?.replicas ?? 1),
      );
      if (allReady) break;
      if (attempt === 119) throw new Error(`Deployments in ${ns} not ready`);
      await Bun.sleep(1000);
    }

    // Wait for jobs to complete
    const { items: jobs } = await batch.listNamespacedJob({ namespace: ns });
    for (const job of jobs) {
      const name = job.metadata!.name!;
      for (let attempt = 0; attempt < 120; attempt++) {
        const j = await batch.readNamespacedJob({ name, namespace: ns });
        if ((j.status?.succeeded ?? 0) >= 1) break;
        if (attempt === 119) throw new Error(`Job ${name} in ${ns} not complete`);
        await Bun.sleep(1000);
      }
    }
  }
}

export function cleanKubeconfigs(): void {
  if (existsSync(KUBECONFIGS_DIR)) {
    rmSync(KUBECONFIGS_DIR, { recursive: true });
  }
}

// --- Server lifecycle ---

export const ROOT_DIR = resolve(TEST_DIR, '..');
export const SERVER_PORT = 18080;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;

let serverProc: ReturnType<typeof Bun.spawn> | null = null;

export async function buildServer(): Promise<void> {
  console.log('Building server...');
  await exec(
    [join(ROOT_DIR, 'mvnw'), '-f', join(ROOT_DIR, 'pom.xml'), 'install', '-DskipTests'],
    { inheritStderr: true },
  );
}

export async function startServer(): Promise<void> {
  const jarPath = join(ROOT_DIR, 'knals-server/target/quarkus-app/quarkus-run.jar');
  if (!existsSync(jarPath)) {
    throw new Error(`Server jar not found at ${jarPath}. Run buildServer() first.`);
  }

  console.log('Starting server...');
  serverProc = Bun.spawn(
    ['java', `-Dquarkus.http.port=${SERVER_PORT}`, '-jar', jarPath],
    { stdout: 'pipe', stderr: 'pipe' },
  );

  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const resp = await fetch(`${SERVER_URL}/q/health/ready`);
      if (resp.ok) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(1000);
  }
  throw new Error('Server did not start within 60s');
}

export function stopServer(): void {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
}
