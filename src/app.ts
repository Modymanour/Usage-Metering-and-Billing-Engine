import express from 'express';
import { router } from './routes/router.ts';
import { StripeWebhookController } from './controllers/stripe-webhook.controller.ts';
const PORT = 3000;

const app = express();
const stripeWebhookController = new StripeWebhookController();

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookController.handle);
app.use(express.json());

app.use(router);

app.listen(
    PORT,
    () => {
        console.log(`server is running on Port : ${PORT}`);
    }
);