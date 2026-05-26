import { join } from 'node:path';
import {
  CLUSTER_NAME,
  MANIFESTS_DIR,
  KUBECONFIGS_DIR,
  clusterExists,
  createCluster,
  bootstrapAuth,
  applyManifests,
  waitForDefaultServiceAccounts,
  waitForResources,
  generateKubeconfig,
} from './helpers';

async function main() {
  if (await clusterExists()) {
    console.log(`Cluster '${CLUSTER_NAME}' already exists, reusing it`);
  } else {
    await createCluster();
  }

  console.log('Bootstrapping auth...');
  const kc = await bootstrapAuth();

  console.log('Applying namespaces...');
  await applyManifests(kc, join(MANIFESTS_DIR, 'namespaces.yaml'));

  console.log('Waiting for default ServiceAccounts...');
  await waitForDefaultServiceAccounts(kc);

  console.log('Applying sample resources...');
  await applyManifests(
    kc,
    join(MANIFESTS_DIR, 'resources', 'team-api.yaml'),
    join(MANIFESTS_DIR, 'resources', 'team-billing.yaml'),
    join(MANIFESTS_DIR, 'resources', 'team-infra.yaml'),
  );

  console.log('Waiting for resources to stabilize...');
  await waitForResources(kc);

  console.log('Generating kubeconfigs...');
  await generateKubeconfig(kc);

  console.log(`\nCluster '${CLUSTER_NAME}' is ready.`);
  console.log(`Use: export KUBECONFIG=${KUBECONFIGS_DIR}/full-access.yaml`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
