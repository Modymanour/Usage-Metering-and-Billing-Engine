import express from 'express';
import { router } from './routes/router.ts';
import { StripeWebhookController } from './controllers/stripe-webhook.controller.ts';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './config/swagger.config.ts';
const PORT = 3000;

const app = express();
const stripeWebhookController = new StripeWebhookController();

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookController.handle);
app.use(express.json());

app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use(router);

app.listen(
    PORT,
    () => {
        console.log(`server is running on Port : ${PORT}`);
        console.log(`swagger can be accessed on: https://mody.myddns.me/docs`)
    }
);