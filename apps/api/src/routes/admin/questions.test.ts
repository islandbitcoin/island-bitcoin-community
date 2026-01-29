import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { questionsAdminRoute } from './questions';
import { db } from '../../db';
import { questions, config } from '../../db/schema';
import { getPublicKey, finalizeEvent, generateSecretKey } from 'nostr-tools';

const ADMIN_SK = generateSecretKey();
const ADMIN_PK = getPublicKey(ADMIN_SK);
const NON_ADMIN_SK = generateSecretKey();
const NON_ADMIN_PK = getPublicKey(NON_ADMIN_SK);

function authHeader(url: string, method: string, sk: Uint8Array): string {
  const event = finalizeEvent({
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['u', url], ['method', method]],
    content: '',
    pubkey: getPublicKey(sk),
  }, sk);
  return `Nostr ${Buffer.from(JSON.stringify(event)).toString('base64')}`;
}

const sampleQuestion = {
  question: 'What is Bitcoin?',
  options: ['Digital gold', 'A stock', 'A bank', 'An app'],
  correctAnswer: 0,
  explanation: 'Bitcoin is digital gold.',
  difficulty: 'easy' as const,
  category: 'basics' as const,
  level: 1,
};

describe('Admin Questions API', () => {
  let app: Hono;

  beforeEach(async () => {
    await db.delete(questions);
    await db.delete(config);
    await db.insert(config).values({
      key: 'admin_pubkeys',
      value: JSON.stringify([ADMIN_PK]),
    });
    app = new Hono();
    app.route('/admin/questions', questionsAdminRoute);
  });

  it('GET / returns 401 without auth', async () => {
    const res = await app.request('http://localhost/admin/questions');
    expect(res.status).toBe(401);
  });

  it('GET / returns 403 for non-admin', async () => {
    const url = 'http://localhost/admin/questions';
    const res = await app.request(url, {
      headers: { Authorization: authHeader(url, 'GET', NON_ADMIN_SK) },
    });
    expect(res.status).toBe(403);
  });

  it('GET / lists all questions', async () => {
    await db.insert(questions).values(sampleQuestion);
    const url = 'http://localhost/admin/questions';
    const res = await app.request(url, {
      headers: { Authorization: authHeader(url, 'GET', ADMIN_SK) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions.length).toBe(1);
    expect(body.questions[0].question).toBe('What is Bitcoin?');
  });

  it('POST / creates a question', async () => {
    const url = 'http://localhost/admin/questions';
    const res = await app.request(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader(url, 'POST', ADMIN_SK),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sampleQuestion),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.question.id).toBeDefined();
    expect(body.question.question).toBe('What is Bitcoin?');
  });

  it('POST / validates input', async () => {
    const url = 'http://localhost/admin/questions';
    const res = await app.request(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader(url, 'POST', ADMIN_SK),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('PUT /:id updates a question', async () => {
    const [inserted] = await db.insert(questions).values(sampleQuestion).returning();
    const url = `http://localhost/admin/questions/${inserted.id}`;
    const res = await app.request(url, {
      method: 'PUT',
      headers: {
        Authorization: authHeader(url, 'PUT', ADMIN_SK),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: 'Updated question?' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.question.question).toBe('Updated question?');
  });

  it('PUT /:id returns 404 for missing question', async () => {
    const url = 'http://localhost/admin/questions/9999';
    const res = await app.request(url, {
      method: 'PUT',
      headers: {
        Authorization: authHeader(url, 'PUT', ADMIN_SK),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: 'Updated?' }),
    });
    expect(res.status).toBe(404);
  });

  it('DELETE /:id soft-deletes a question', async () => {
    const [inserted] = await db.insert(questions).values(sampleQuestion).returning();
    const url = `http://localhost/admin/questions/${inserted.id}`;
    const res = await app.request(url, {
      method: 'DELETE',
      headers: { Authorization: authHeader(url, 'DELETE', ADMIN_SK) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.question.active).toBe(false);
  });

  it('DELETE /:id returns 404 for missing question', async () => {
    const url = 'http://localhost/admin/questions/9999';
    const res = await app.request(url, {
      method: 'DELETE',
      headers: { Authorization: authHeader(url, 'DELETE', ADMIN_SK) },
    });
    expect(res.status).toBe(404);
  });
});
