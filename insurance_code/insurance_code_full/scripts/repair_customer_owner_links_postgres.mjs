import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const STORAGE_BACKEND = String(process.env.STORAGE_BACKEND || 'postgres').toLowerCase();
const DATABASE_URL = process.env.DATABASE_URL;
if (STORAGE_BACKEND !== 'postgres') {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: `storage_backend=${STORAGE_BACKEND}` }, null, 2));
  process.exit(0);
}
if (!DATABASE_URL) {
  console.error('[owner:repair] DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: invalidRows } = await client.query(`
      SELECT c.id, c.tenant_id, c.owner_agent_id
      FROM c_customers c
      LEFT JOIN b_agents a
        ON a.id = c.owner_agent_id
       AND a.tenant_id = c.tenant_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE COALESCE(c.is_deleted, false) = false
        AND c.owner_agent_id IS NOT NULL
        AND c.owner_agent_id > 0
        AND a.id IS NULL
      ORDER BY c.tenant_id, c.id
    `);

    const { rows: fallbackRows } = await client.query(`
      WITH tenant_pool AS (
        SELECT DISTINCT tenant_id
        FROM c_customers
        WHERE COALESCE(is_deleted, false) = false
      )
      SELECT
        t.tenant_id,
        COALESCE(
          (
            SELECT a1.id
            FROM b_agents a1
            WHERE a1.tenant_id = t.tenant_id
              AND COALESCE(a1.is_deleted, false) = false
              AND LOWER(COALESCE(a1.status, 'active')) = 'active'
              AND LOWER(COALESCE(a1.role, '')) IN ('agent', 'salesperson')
            ORDER BY a1.id
            LIMIT 1
          ),
          (
            SELECT a2.id
            FROM b_agents a2
            WHERE a2.tenant_id = t.tenant_id
              AND COALESCE(a2.is_deleted, false) = false
              AND LOWER(COALESCE(a2.status, 'active')) = 'active'
            ORDER BY a2.id
            LIMIT 1
          ),
          (
            SELECT a3.id
            FROM b_agents a3
            WHERE a3.tenant_id = t.tenant_id
              AND COALESCE(a3.is_deleted, false) = false
            ORDER BY a3.id
            LIMIT 1
          )
        ) AS fallback_agent_id
      FROM tenant_pool t
    `);
    const fallbackMap = new Map(fallbackRows.map((row) => [Number(row.tenant_id), Number(row.fallback_agent_id || 0)]));

    let reassigned = 0;
    let cleared = 0;
    const detail = [];
    for (const row of invalidRows) {
      const customerId = Number(row.id || 0);
      const tenantId = Number(row.tenant_id || 0);
      const oldOwner = Number(row.owner_agent_id || 0);
      const fallbackAgentId = Number(fallbackMap.get(tenantId) || 0);
      if (fallbackAgentId > 0) {
        await client.query(
          `UPDATE c_customers SET owner_agent_id = $2, updated_at = NOW() WHERE id = $1`,
          [customerId, fallbackAgentId]
        );
        reassigned += 1;
        detail.push({ customerId, tenantId, oldOwner, newOwner: fallbackAgentId, action: 'reassigned' });
      } else {
        await client.query(`UPDATE c_customers SET owner_agent_id = NULL, updated_at = NOW() WHERE id = $1`, [customerId]);
        cleared += 1;
        detail.push({ customerId, tenantId, oldOwner, newOwner: null, action: 'cleared' });
      }
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          ok: true,
          invalidCount: invalidRows.length,
          reassigned,
          cleared,
          detail: detail.slice(0, 50),
        },
        null,
        2
      )
    );
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[owner:repair] failed:', err?.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
