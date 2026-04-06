import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[fk:repair] DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false,
});

async function deleteAndCount(client, tableName, alias, whereSql) {
  const sql = `
    WITH doomed AS (
      SELECT ctid FROM ${tableName} ${alias} WHERE ${whereSql}
    )
    DELETE FROM ${tableName} t
    USING doomed d
    WHERE t.ctid = d.ctid
    RETURNING 1
  `;
  const { rowCount } = await client.query(sql);
  return Number(rowCount || 0);
}

async function updateAndCount(client, tableName, setSql, whereSql) {
  const sql = `
    UPDATE ${tableName}
    SET ${setSql}
    WHERE ${whereSql}
    RETURNING 1
  `;
  const { rowCount } = await client.query(sql);
  return Number(rowCount || 0);
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const removed = {};
    const fixed = {};

    fixed.c_customers_owner_agent = await updateAndCount(
      client,
      'c_customers c',
      'owner_agent_id = NULL, updated_at = NOW()',
      `COALESCE(c.is_deleted, false) = false
       AND c.owner_agent_id IS NOT NULL
       AND c.owner_agent_id > 0
       AND NOT EXISTS (
         SELECT 1
         FROM b_agents a
         WHERE a.id = c.owner_agent_id
           AND a.tenant_id = c.tenant_id
           AND COALESCE(a.is_deleted, false) = false
       )`
    );

    removed.p_sessions = await deleteAndCount(
      client,
      'p_sessions',
      's',
      'NOT EXISTS (SELECT 1 FROM c_customers c WHERE c.id = s.customer_id)'
    );

    removed.p_orders_customer = await deleteAndCount(
      client,
      'p_orders',
      'o',
      'NOT EXISTS (SELECT 1 FROM c_customers c WHERE c.id = o.customer_id)'
    );

    removed.p_orders_product = await deleteAndCount(
      client,
      'p_orders',
      'o',
      'NOT EXISTS (SELECT 1 FROM p_products p WHERE p.id = o.product_id)'
    );

    removed.c_redeem_customer = await deleteAndCount(
      client,
      'c_redeem_records',
      'r',
      'NOT EXISTS (SELECT 1 FROM c_customers c WHERE c.id = r.customer_id)'
    );

    removed.c_redeem_product = await deleteAndCount(
      client,
      'c_redeem_records',
      'r',
      'NOT EXISTS (SELECT 1 FROM p_products p WHERE p.id = r.product_id)'
    );

    removed.c_sign_ins = await deleteAndCount(
      client,
      'c_sign_ins',
      's',
      'NOT EXISTS (SELECT 1 FROM c_customers c WHERE c.id = s.customer_id)'
    );

    removed.c_activity_customer = await deleteAndCount(
      client,
      'c_activity_completions',
      'a',
      'NOT EXISTS (SELECT 1 FROM c_customers c WHERE c.id = a.customer_id)'
    );

    removed.c_activity_activity = await deleteAndCount(
      client,
      'c_activity_completions',
      'a',
      'NOT EXISTS (SELECT 1 FROM p_activities p WHERE p.id = a.activity_id)'
    );

    removed.c_learning_customer = await deleteAndCount(
      client,
      'c_learning_records',
      'l',
      'NOT EXISTS (SELECT 1 FROM c_customers c WHERE c.id = l.customer_id)'
    );

    removed.c_learning_material = await deleteAndCount(
      client,
      'c_learning_records',
      'l',
      'NOT EXISTS (SELECT 1 FROM p_learning_materials m WHERE m.id = l.material_id)'
    );

    await client.query('COMMIT');

    const totalRemoved = Object.values(removed).reduce((sum, n) => sum + Number(n || 0), 0);
    const totalFixed = Object.values(fixed).reduce((sum, n) => sum + Number(n || 0), 0);
    console.log(JSON.stringify({ ok: true, totalRemoved, totalFixed, removed, fixed }, null, 2));
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[fk:repair] failed:', err?.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
