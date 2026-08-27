import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* AUTH                                                                     */
/* -------------------------------------------------------------------------- */
export const registerSchema = z.object({
    name: z.string(),
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8).max(256),
})

export const tenantUpdateSchema = z.object({
    id: z.uuid(),
    name: z.string(),
})

/* -------------------------------------------------------------------------- */
/* Plans                                                                     */
/* -------------------------------------------------------------------------- */

export const planCreateSchema = z.object({
    name: z.string(),
    api_call_limit: z.number().min(0),
    api_token_limit: z.number().min(0)
});

export const planUpdateSchema = z.object({
    id: z.uuid(),
    name: z.string().nullable(),
    api_call_limit: z.number().min(0).nullable(),
    api_token_limit: z.number().min(0).nullable()
});

/* -------------------------------------------------------------------------- */
/* Subscription                                                                      */
/* -------------------------------------------------------------------------- */

export const subscriptionCreateSchema = z.object({
    tenant_id: z.uuid(),
    plan_id: z.uuid(),
    sub_status: z.string(),
    start_from: z.date(),
    ends_at: z.date,
    stripe_id: z.string().nullable(),
});

export const subscriptionUpdateSchema = z.object({
    id: z.uuid(),
    tenant_id: z.uuid(),
    plan_id: z.uuid(),
    sub_status: z.string(),
    start_from: z.date(),
    ends_at: z.date,
    stripe_id: z.string().nullable(),
});

/* -------------------------------------------------------------------------- */
/* User Events                                                                      */
/* -------------------------------------------------------------------------- */

export const eventCreateSchema = z.object({
    tenant_id: z.uuid(),
    idempotency_key: z.string(),
    event_type: z.string(),
    quantity: z.number()
})

export const eventUpdateSchema = z.object({
    id: z.uuid(),
    tenant_id: z.uuid().nullable(),
    idempotency_key: z.string().nullable(),
    event_type: z.string().nullable(),
    quantity: z.number().nullable()
})
