"use strict";
const express = require("express");
const { nextTimeFromNow } = require('./src/time');
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
const PORT = process.env.PORT || 5000;

// Logger minimal: méthode, chemin, status, durée
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    const dt = Date.now() - t0;
    console.log(`${req.method} ${req.path} -> ${res.statusCode} ${dt}ms`);
  });
  next();
});

// Santé
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: 'dernier-metro-api' }));

app.get('/DBhealth', async (_req, res) => { 
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('Database connection error:', err);
    return res.status(500).json({ status: 'error', database: 'unreachable' });
  }
});


// Endpoint métier minimal
app.get('/next-metro', (req, res) => {
  const station = (req.query.station || '').toString().trim();
  if (!station) return res.status(400).json({ error: "missing station" });
  return res.status(200).json({ station, line: 'M1', headwayMin: 3, nextArrival: nextTimeFromNow(3) });
});


// Endpoint pour le dernier métro
app.get('/last-metro', async (req, res) => {
  const raw = (req.query.station || '').toString().trim();
  const station = raw.replace(/^['"]+|['"]+$/g, '');
  if (!station) return res.status(400).json({ error: 'missing station' });

  try {
    const defaultsSql = `
      SELECT value->>'line' AS line, value->>'TimeZone' AS tz
      FROM config
      WHERE key = 'metro.defaults'
      LIMIT 1;
    `;
    const { rows: defRows } = await pool.query(defaultsSql);
    if (!defRows.length) return res.status(500).json({ error: 'missing config metro.defaults' });
    const { line, tz } = defRows[0];

    const lastSql = `
      SELECT j.key  AS station,
             j.value AS last_metro
      FROM config c
      CROSS JOIN LATERAL jsonb_each_text(c.value) AS j(key, value)
      WHERE c.key = 'metro.last'
        AND lower(j.key) = lower($1)
      LIMIT 1;
    `;
    const { rows } = await pool.query(lastSql, [station]);
    if (!rows.length) return res.status(404).json({ error: 'unknown station' });

    return res.status(200).json({
      station: rows[0].station,
      lastMetro: rows[0].last_metro,
      line,
      tz
    });
  } catch (err) {
    console.error('last-metro error:', err);
    return res.status(500).json({ error: 'internal error' });
  }
});

// 404 JSON
app.use((_req, res) => res.status(404).json({ error: 'not found' }));

if (require.main === module) {
  app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
}

module.exports = { app };
