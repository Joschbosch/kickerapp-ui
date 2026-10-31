// Übernimmt den API-Vertrag (openapi.json) aus dem Backend-Repo. Standard: Nachbarordner ../kickerapp.
// Anderer Ort: Umgebungsvariable KICKERTOOL_BACKEND_DIR.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(root, process.env.KICKERTOOL_BACKEND_DIR ?? '../kickerapp');
const source = resolve(backend, 'docs/openapi.json');
const target = resolve(root, 'api/openapi.json');

if (!existsSync(source)) {
  console.error(`Vertrag nicht gefunden: ${source}\nBackend-Repo daneben auschecken oder KICKERTOOL_BACKEND_DIR setzen.`);
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`Vertrag übernommen: ${source} -> ${target}`);