import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db';
import { questions } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireAdmin } from '../../middleware/auth';

export const questionsAdminRoute = new Hono();

const createQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.enum(['basics', 'technical', 'history', 'lightning', 'culture']),
  level: z.number().int().min(1).max(21),
});

const updateQuestionSchema = createQuestionSchema.partial().extend({
  active: z.boolean().optional(),
});

questionsAdminRoute.get(
  '/',
  requireAuth,
  requireAdmin,
  async (c) => {
    const allQuestions = await db.select().from(questions);
    return c.json({ questions: allQuestions });
  }
);

questionsAdminRoute.post(
  '/',
  requireAuth,
  requireAdmin,
  zValidator('json', createQuestionSchema),
  async (c) => {
    const data = c.req.valid('json');
    const result = await db.insert(questions).values(data).returning();
    return c.json({ question: result[0] }, 201);
  }
);

questionsAdminRoute.put(
  '/:id',
  requireAuth,
  requireAdmin,
  zValidator('json', updateQuestionSchema),
  async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const existing = await db.select().from(questions).where(eq(questions.id, id)).get();
    if (!existing) return c.json({ error: 'Question not found' }, 404);

    const data = c.req.valid('json');
    const result = await db.update(questions).set(data).where(eq(questions.id, id)).returning();
    return c.json({ question: result[0] });
  }
);

questionsAdminRoute.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  async (c) => {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) return c.json({ error: 'Invalid ID' }, 400);

    const existing = await db.select().from(questions).where(eq(questions.id, id)).get();
    if (!existing) return c.json({ error: 'Question not found' }, 404);

    const result = await db.update(questions)
      .set({ active: false })
      .where(eq(questions.id, id))
      .returning();
    return c.json({ question: result[0] });
  }
);
