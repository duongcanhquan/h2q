import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const need = [
  'app/login/page.tsx',
  'app/api/auth/login/route.ts',
  'lib/frappe/client.ts',
  'proxy.ts',
];
for (const rel of need) {
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}
const client = fs.readFileSync(path.join(root, 'lib/frappe/client.ts'), 'utf8');
assert.match(client, /interceptors\.response/);
assert.match(client, /401/);
console.log('STEP2_SMOKE_OK');
