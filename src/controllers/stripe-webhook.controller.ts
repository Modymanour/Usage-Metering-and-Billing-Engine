import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { ControllerErrorHelper } from './helper.ts';
import { StripeWebhookService } from '../services/stripe-webhook.service.ts';

export class StripeWebhookController {
    constructor(
        private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder'),
        private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '',
        private readonly webhookService = new StripeWebhookService(),
    ) {}

    async handle(req: Request, res: Response): Promise<Response> {
        const signature = req.header('stripe-signature');
        if (!signature || !this.webhookSecret) {
            return res.status(400).json({ error: 'Stripe webhook configuration is missing' });
        }

        try {
            const event = this.stripe.webhooks.constructEvent(req.body as Buffer, signature, this.webhookSecret);
            const result = await this.webhookService.process(event);
            return res.status(200).json({ received: true, duplicate: result.duplicate });
        } catch (error) {
            return ControllerErrorHelper.handle(error, res, 'StripeWebhookController.handle', {
                method: req.method,
                path: req.originalUrl,
                stripeEventId: req.header('stripe-event-id') ?? null,
            });
        }
    }
}