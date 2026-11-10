const { neon } = require('@neondatabase/serverless');

const KEYS = ['db', 'pick', 'pack', 'hist', 'users', 'batches'];

let sql;
let ready = false;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!sql) sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
    if (!ready) {
      await sql`create table if not exists kv (
        k text primary key,
        v jsonb not null,
        updated_at timestamptz default now()
      )`;
      ready = true;
    }

    if (req.method === 'GET') {
      const rows = await sql`select k, v from kv`;
      const out = {};
      rows.forEach((r) => { out[r.k] = r.v; });
      return res.status(200).json(out);
    }

    if (req.method === 'POST') {
      const { k, v } = req.body || {};
      if (!KEYS.includes(k) || v === undefined) {
        return res.status(400).json({ error: 'bad request' });
      }
      await sql`insert into kv (k, v) values (${k}, ${JSON.stringify(v)}::jsonb)
        on conflict (k) do update set v = excluded.v, updated_at = now()`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server error' });
  }
};
