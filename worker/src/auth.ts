import type { MiddlewareHandler } from 'hono';
import type { Env } from './types';

export const adminAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const email = c.req.header('X-Admin-Email');
  if (!email || email !== c.env.ADMIN_EMAIL) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
};
