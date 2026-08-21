import express from 'express';
import { router } from './routes/router.ts';
const PORT = 3000;

const app = express();

app.use(express.json());

app.use(router);

app.listen(
    PORT,
    () => {
        console.log(`server is running on Port : ${PORT}`);
        console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    }
);