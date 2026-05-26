import { deleteCluster, cleanKubeconfigs } from './helpers';

async function main() {
  await deleteCluster();

  console.log('Removing generated kubeconfigs...');
  cleanKubeconfigs();

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
