import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const schemaFile = path.join(workspaceRoot, 'server', 'data', 'schema_phase_a_prd_v1.sql');
const stateFile = path.join(workspaceRoot, 'server', 'skeleton-c-v1', 'common', 'state.mjs');

describe('customer share schema persistence', () => {
  it('stores referrer share code as TEXT in base schema', () => {
    const schema = fs.readFileSync(schemaFile, 'utf8');
    expect(schema).toContain('ALTER TABLE c_customers ADD COLUMN IF NOT EXISTS referrer_share_code TEXT;');
  });

  it('widens runtime customer share code column during postgres migrations', () => {
    const stateSource = fs.readFileSync(stateFile, 'utf8');
    expect(stateSource).toContain('ALTER TABLE c_customers ALTER COLUMN referrer_share_code TYPE TEXT;');
  });
});
