import type { Request, Response } from "express";
import type { UUID } from "node:crypto";
import { MeterService } from "../services/meter.service";
import { eventCreateSchema, checkQuotaSchema } from "../schemas";
import { ControllerErrorHelper } from "./helper";

export class MeterController{
    constructor(
        private readonly meterService = new MeterService()
    ) {}

    async generate(
        req: Request,
        res: Response
    ){
        const result = eventCreateSchema.safeParse(req.body);

        if (!result.success) {
            return ControllerErrorHelper.handle(result.error, res, "MeterController.generate", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }

        const input = {
            ...result.data,
            tenant_id: result.data.tenant_id as UUID,
        };

        try {
            const event = await this.meterService.recordUsage(input);
            return res.status(201).json(event);
        } catch (err) {
            return ControllerErrorHelper.handle(err, res, "MeterController.generate", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }

    async getQuota(
        req: Request,
        res: Response
    ){
        const result = checkQuotaSchema.safeParse(req.body);

        if (!result.success) {
            return ControllerErrorHelper.handle(result.error, res, "MeterController.getQuota", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }

        const input = {
            type: result.data.type,
            tenant_id: result.data.tenant_id as UUID
        };

        try {
            const event = await this.meterService.checkQuota(input);
            return res.status(200).json(event);
        } catch (err) {
            return ControllerErrorHelper.handle(err, res, "MeterController.getQuota", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
}