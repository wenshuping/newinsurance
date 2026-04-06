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
  console.error('[fk:precheck] DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
});

const checks = [
  {
    key: 'c_customers.owner_agent_id -> b_agents.id (same tenant)',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM c_customers c
      LEFT JOIN b_agents a
        ON a.id = c.owner_agent_id
       AND a.tenant_id = c.tenant_id
       AND COALESCE(a.is_deleted, false) = false
      WHERE COALESCE(c.is_deleted, false) = false
        AND c.owner_agent_id IS NOT NULL
        AND c.owner_agent_id > 0
        AND a.id IS NULL
    `,
  },
  {
    key: 'p_sessions.customer_id -> c_customers.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM p_sessions s
      LEFT JOIN c_customers c ON c.id = s.customer_id
      WHERE s.customer_id IS NOT NULL
        AND s.customer_id > 0
        AND c.id IS NULL
    `,
  },
  {
    key: 'p_orders.customer_id -> c_customers.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM p_orders o
      LEFT JOIN c_customers c ON c.id = o.customer_id
      WHERE c.id IS NULL
    `,
  },
  {
    key: 'p_orders.product_id -> p_products.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM p_orders o
      LEFT JOIN p_products p ON p.id = o.product_id
      WHERE p.id IS NULL
    `,
  },
  {
    key: 'c_redeem_records.customer_id -> c_customers.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM c_redeem_records r
      LEFT JOIN c_customers c ON c.id = r.customer_id
      WHERE c.id IS NULL
    `,
  },
  {
    key: 'c_redeem_records.product_id -> p_products.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM c_redeem_records r
      LEFT JOIN p_products p ON p.id = r.product_id
      WHERE p.id IS NULL
    `,
  },
  {
    key: 'c_sign_ins.customer_id -> c_customers.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM c_sign_ins s
      LEFT JOIN c_customers c ON c.id = s.customer_id
      WHERE c.id IS NULL
    `,
  },
  {
    key: 'c_activity_completions.customer_id -> c_customers.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM c_activity_completions a
      LEFT JOIN c_customers c ON c.id = a.customer_id
      WHERE c.id IS NULL
    `,
  },
  {
    key: 'c_activity_completions.activity_id -> p_activities.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM c_activity_completions a
      LEFT JOIN p_activities p ON p.id = a.activity_id
      WHERE p.id IS NULL
    `,
  },
  {
    key: 'c_learning_records.customer_id -> c_customers.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM c_learning_records l
      LEFT JOIN c_customers c ON c.id = l.customer_id
      WHERE c.id IS NULL
    `,
  },
  {
    key: 'c_learning_records.material_id -> p_learning_materials.id',
    sql: `
      SELECT COUNT(*)::int AS cnt
      FROM c_learning_records l
      LEFT JOIN p_learning_materials m ON m.id = l.material_id
      WHERE m.id IS NULL
    `,
  },
];

async function run() {
  try {
    const result = [];
    let total = 0;
    for (const item of checks) {
      const { rows } = await pool.query(item.sql);
      const cnt = Number(rows[0]?.cnt || 0);
      total += cnt;
      result.push({ check: item.key, orphanCount: cnt });
    }

    const payload = { ok: total === 0, totalOrphans: total, checks: result };
    console.log(JSON.stringify(payload, null, 2));
    process.exit(total === 0 ? 0 : 2);
  } catch (err) {
    console.error('[fk:precheck] failed:', err?.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
