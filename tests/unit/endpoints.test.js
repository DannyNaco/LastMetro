// 1) MOCK de 'pg' – doit être AVANT tout import de server.js
jest.mock('pg', () => {
  const query = jest.fn();                        // on pilotera son retour dans les tests
  const mockPoolInstance = { query };
  const Pool = jest.fn(() => mockPoolInstance);   // new Pool(...) -> { query }
  return { Pool };
});

const request = require('supertest');
const { app } = require('../../server');  // n'écoute pas (guard déjà en place)
const { Pool } = require('pg');           // <-- c'est le mock ci-dessus

// helper fiable pour récupérer le query mock
const getQueryMock = () =>
  (Pool.mock.results[0] && Pool.mock.results[0].value && Pool.mock.results[0].value.query)
  || (Pool.mock.instances[0] && Pool.mock.instances[0].query);

let queryMock;

beforeEach(() => {
  queryMock = getQueryMock();
  if (!queryMock) {
    throw new Error('Mock PG non initialisé. Vérifie que jest.mock("pg") est au tout début du fichier.');
  }
  queryMock.mockReset();
});

/* ---------------------- /next-metro ---------------------- */
describe('GET /next-metro', () => {
  it('200 avec station -> nextArrival HH:MM', async () => {
    const res = await request(app).get('/next-metro').query({ station: 'Bastille' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('station', 'Bastille');
    expect(res.body).toHaveProperty('line', 'M1');
    expect(res.body).toHaveProperty('headwayMin', 3);
    expect(res.body.nextArrival).toMatch(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
    expect(queryMock).not.toHaveBeenCalled(); // ne touche pas la DB
  });

  it('400 sans station', async () => {
    const res = await request(app).get('/next-metro');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing station' });
  });
});

/* ---------------------- /last-metro ---------------------- */
describe('GET /last-metro', () => {
  it('200 station connue -> {station,lastMetro,line,tz}', async () => {
    // Ton server fait 2 requêtes :
    // 1) defaultsSql
    queryMock.mockResolvedValueOnce({ rows: [{ line: 'M1', tz: 'Europe/Paris' }] });
    // 2) lastSql (jsonb_each_text)
    queryMock.mockResolvedValueOnce({ rows: [{ station: 'Châtelet', last_metro: '00:58' }] });

    const res = await request(app).get('/last-metro').query({ station: 'Châtelet' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      station: 'Châtelet',
      lastMetro: '00:58',
      line: 'M1',
      tz: 'Europe/Paris'
    });
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('404 station inconnue', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ line: 'M1', tz: 'Europe/Paris' }] }); // defaults ok
    queryMock.mockResolvedValueOnce({ rows: [] }); // station absente

    const res = await request(app).get('/last-metro').query({ station: 'Zzz' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'unknown station' });
  });

  it('400 sans station', async () => {
    const res = await request(app).get('/last-metro');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'missing station' });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('500 quand defaults manquent', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] }); // pas de metro.defaults

    const res = await request(app).get('/last-metro').query({ station: 'Châtelet' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'missing config metro.defaults' });
  });

  it('500 si erreur DB', async () => {
    queryMock.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/last-metro').query({ station: 'Châtelet' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal error' });
  });
});

/* ---------------------- /DBhealth ---------------------- */
describe('GET /DBhealth', () => {
  it('200 quand SELECT 1 passe', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    const res = await request(app).get('/DBhealth');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'connected' });
    expect(queryMock).toHaveBeenCalledWith('SELECT 1');
  });

  it('500 quand SELECT 1 échoue', async () => {
    queryMock.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app).get('/DBhealth');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ status: 'error', database: 'unreachable' });
  });
});
