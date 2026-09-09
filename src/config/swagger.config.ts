import { z, type ZodType } from 'zod';
import type { OpenAPIV3 } from 'openapi-types';
import {
    eventCreateSchema,
    registerSchema,
    subscriptionChangeStatusSchema,
    subscriptionCreateSchema,
    subscriptionUpdatePlanSchema,
    tenantUpdateSchema,
} from '../schemas/index.ts';

const dateTimeFields: Record<string, string[]> = {
    SubscriptionCreate: ['start_from', 'ends_at'],
};

function schemaFromZod(schema: ZodType, name: string): OpenAPIV3.SchemaObject {
    const jsonSchema = z.toJSONSchema(schema, {
        target: 'draft-7',
        unrepresentable: 'any',
    }) as OpenAPIV3.SchemaObject & { $schema?: string };

    delete jsonSchema.$schema;
    for (const field of dateTimeFields[name] ?? []) {
        const property = jsonSchema.properties?.[field] as Record<string, unknown> | undefined;
        if (property) {
            property.type = 'string';
            property.format = 'date-time';
        }
    }
    return jsonSchema;
}

const uuidParameter = (name: string): OpenAPIV3.ParameterObject => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', format: 'uuid' },
});

const paginationParameters: OpenAPIV3.ParameterObject[] = [
    { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
    { name: 'pageNumber', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 10 } },
];

const jsonResponse = (description = 'Successful response'): OpenAPIV3.ResponseObject => ({
    description,
    content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
});

const requestBody = (schemaName: string): OpenAPIV3.RequestBodyObject => ({
    required: true,
    content: { 'application/json': { schema: { $ref: `#/components/schemas/${schemaName}` } } },
});

const errorResponse: OpenAPIV3.ResponseObject = {
    description: 'Request or server error',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};

const operation = (
    summary: string,
    responses: OpenAPIV3.ResponsesObject,
    options: Partial<Pick<OpenAPIV3.OperationObject, 'requestBody' | 'parameters' | 'tags'>> = {},
): OpenAPIV3.OperationObject => ({
    summary,
    ...options,
    responses: { ...responses, '400': errorResponse, '500': errorResponse },
});

export const openApiDocument: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: {
        title: 'Usage Metering and Billing Engine API',
        version: '1.0.0',
        description: 'Tenant, subscription, usage metering, and quota management API.',
    },
    servers: [{ url: 'http://localhost:3000' }],
    tags: [
        { name: 'Auth' },
        { name: 'Tenants' },
        { name: 'Subscriptions' },
        { name: 'Metering' },
        { name: 'Webhooks' },
    ],
    paths: {
        '/billing-metering/auth/sign-up': {
            post: operation('Register a tenant', { '200': jsonResponse() }, { tags: ['Auth'], requestBody: requestBody('Register') }),
        },
        '/billing-metering/tenant': {
            put: operation('Update a tenant', { '201': jsonResponse() }, { tags: ['Tenants'], requestBody: requestBody('TenantUpdate') }),
            get: operation('List tenants', { '200': jsonResponse() }, { tags: ['Tenants'], parameters: paginationParameters }),
        },
        '/billing-metering/tenant/{id}': {
            get: operation('Get a tenant by ID', { '200': jsonResponse() }, { tags: ['Tenants'], parameters: [uuidParameter('id')] }),
            delete: operation('Remove a tenant', { '200': jsonResponse() }, { tags: ['Tenants'], parameters: [uuidParameter('id')] }),
        },
        '/billing-metering/subscription': {
            post: operation('Create a subscription', { '200': jsonResponse() }, { tags: ['Subscriptions'], requestBody: requestBody('SubscriptionCreate') }),
            get: operation('List subscriptions', { '200': jsonResponse() }, { tags: ['Subscriptions'], parameters: paginationParameters }),
        },
        '/billing-metering/subscription/plan': {
            put: operation('Change a subscription plan', { '201': jsonResponse() }, { tags: ['Subscriptions'], requestBody: requestBody('SubscriptionUpdatePlan') }),
        },
        '/billing-metering/subscription/status': {
            put: operation('Change subscription status', { '201': jsonResponse() }, { tags: ['Subscriptions'], requestBody: requestBody('SubscriptionChangeStatus') }),
        },
        '/billing-metering/subscription/{id}': {
            get: operation('Get a subscription by ID', { '200': jsonResponse() }, { tags: ['Subscriptions'], parameters: [uuidParameter('id')] }),
            delete: operation('Delete a subscription', { '200': jsonResponse() }, { tags: ['Subscriptions'], parameters: [uuidParameter('id')] }),
        },
        '/billing-metering/generate': {
            post: operation('Record a usage event', { '201': jsonResponse() }, { tags: ['Metering'], requestBody: requestBody('EventCreate') }),
        },
        '/billing-metering/usage/{tenant_id}': {
            get: operation('Get current tenant usage', { '200': jsonResponse() }, { tags: ['Metering'], parameters: [uuidParameter('tenant_id')] }),
        },
        '/billing-metering/get-quota/{tenant_id}': {
            get: operation('Get current tenant quota', { '200': jsonResponse() }, { tags: ['Metering'], parameters: [uuidParameter('tenant_id')] }),
        },
        '/billing-metering/user-events': {
            get: operation('List usage events', { '200': jsonResponse() }, { tags: ['Metering'], parameters: paginationParameters }),
        },
        '/webhooks/stripe': {
            post: operation('Receive a Stripe webhook', { '200': jsonResponse() }, {
                tags: ['Webhooks'],
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
            }),
        },
    },
    components: {
        schemas: {
            Register: schemaFromZod(registerSchema, 'Register'),
            TenantUpdate: schemaFromZod(tenantUpdateSchema, 'TenantUpdate'),
            SubscriptionCreate: schemaFromZod(subscriptionCreateSchema, 'SubscriptionCreate'),
            SubscriptionUpdatePlan: schemaFromZod(subscriptionUpdatePlanSchema, 'SubscriptionUpdatePlan'),
            SubscriptionChangeStatus: schemaFromZod(subscriptionChangeStatusSchema, 'SubscriptionChangeStatus'),
            EventCreate: schemaFromZod(eventCreateSchema, 'EventCreate'),
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    msg: { type: 'string' },
                    issues: { type: 'array', items: { type: 'object' } },
                },
            },
        },
    },
};