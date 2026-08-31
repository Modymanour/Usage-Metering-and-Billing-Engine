import type { Response } from "express";

export class ControllerErrorHelper {
    static handle(
        err: unknown,
        res: Response,
        context: string,
        state?: Record<string, unknown>
    ): Response {
        const error = err instanceof Error ? err : new Error(String(err));

        console.error(JSON.stringify({
            context,
            timestamp: new Date().toISOString(),
            state: state ?? null,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            }
        }, null, 2));

        if (error.name === "NotFoundError") {
            return res.status(404).json({ error: "Not Found error", msg: error.message });
        }

        if (error.name === "ValidationError") {
            return res.status(400).json({ error: "Validation error", msg: error.message });
        }

        if (error.name === "StripeSignatureVerificationError") {
            return res.status(400).json({ error: "Invalid Stripe webhook signature", msg: error.message });
        }

        if(error.name === "StripeConfiguration"){
            return res.status(400).json({ error: "Invalid Stripe Configuration", msg: error.message });
        }
        
        if(error.name === "TooManyRequests"){
            return res.status(429).json({ error: "Too Many requests", msg: error.message})
        }

        if(error.name === "PaymentRequired"){
            return res.status(402).json({ error: "Payment Required", msg: error.message})
        }

        if (typeof (error as { issues?: unknown }).issues !== "undefined") {
            return res.status(400).json({
                error: "Invalid request payload",
                issues: (error as { issues?: unknown }).issues,
            });
        }

        return res.status(500).json({
            error: "Internal server error",
            msg: error.message
        });
    }
}

export const handleError = ControllerErrorHelper.handle; 
