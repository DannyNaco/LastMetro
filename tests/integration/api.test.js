const request = require('supertest');
const baseURL = process.env.API_BASE || 'http://localhost:5000';
const api = request(baseURL);

const waitReady = async (path, ms = 30000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await api.get(path); if (r.status === 200) return; } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('API not ready');
};

beforeAll(async () => {
  await waitReady('/health');
  await waitReady('/DBhealth');
}, 40000);

test('/last-metro 200', async () => {
  const r = await api.get('/last-metro').query({ station: 'Chatelet' });
  expect(r.status).toBe(200);
  expect(r.body).toHaveProperty('station');
  expect(r.body).toHaveProperty('lastMetro');
  expect(r.body).toHaveProperty('line');
  expect(r.body).toHaveProperty('tz');
});

test('/last-metro 404', async () => {
  const r = await api.get('/last-metro').query({ station: 'Zzz' });
  expect(r.status).toBe(404);
});
