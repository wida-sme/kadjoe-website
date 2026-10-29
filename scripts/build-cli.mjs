// Bundles the command-line scripts the container runs without a TypeScript toolchain.
import { build } from 'esbuild';

for (const name of ['migrate', 'create-admin']) {
  await build({
    entryPoints: [`scripts/${name}.ts`],
    outfile: `dist/${name}.mjs`,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    external: ['better-sqlite3'],
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    logLevel: 'warning',
  });
  console.log(`dist/${name}.mjs`);
}
