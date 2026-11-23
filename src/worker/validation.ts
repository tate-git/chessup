// 요청 본문·쿼리 검사(Zod) — 틀리면 400 invalid_input
import type { Context } from 'hono';
import type { z } from 'zod';
import { invalidInput } from './errors';

export async function parseBody<Schema extends z.ZodType>(context: Context, schema: Schema): Promise<z.infer<Schema>> {
  const body = await context.req.json().catch(() => undefined);
  return check(schema, body);
}

export function parseQuery<Schema extends z.ZodType>(context: Context, schema: Schema): z.infer<Schema> {
  return check(schema, context.req.query());
}

function check<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidInput(parsed.error.issues[0]?.message ?? '입력이 올바르지 않아요');
  return parsed.data;
}
