import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ADMIN_API_ROOT = join(process.cwd(), 'src/app/api/admin');
const ROUTE_HANDLER = /^export async function (GET|POST|PUT|PATCH|DELETE)\([^)]*\) \{/gm;
const ROUTE_AUTH = /adminApiGuard\(|requireAdminUser\(|requirePhysicalStoreAdmin\(/;

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectRouteFiles(path);
    return entry.name === 'route.ts' ? [path] : [];
  });
}

test('every admin route handler performs route-level authorization', () => {
  const missingGuards: string[] = [];

  for (const file of collectRouteFiles(ADMIN_API_ROOT)) {
    const source = readFileSync(file, 'utf8');
    const handlers = [...source.matchAll(ROUTE_HANDLER)];
    assert.ok(handlers.length > 0, `${file} has no route handler`);

    handlers.forEach((handler, index) => {
      const start = handler.index ?? 0;
      const end = handlers[index + 1]?.index ?? source.length;
      const handlerSource = source.slice(start, end);
      if (!ROUTE_AUTH.test(handlerSource)) {
        missingGuards.push(`${file}:${handler[1]}`);
      }
    });
  }

  assert.deepEqual(missingGuards, []);
});
