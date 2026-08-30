import type { Request, Response } from "express";
import type { UUID } from "node:crypto";
import { MeterService } from "../services/meter.service.ts";
import { eventCreateSchema, checkQuotaSchema } from "../schemas";
import { ControllerErrorHelper } from "./helper.ts";

export class MeterController{
    constructor(
        private readonly meterService = new MeterService()
    ) {}

    generate = async(
        req: Request,
        res: Response
    ): Promise<Response> => {
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

    getQuota = async(
        req: Request,
        res: Response
    ): Promise<Response> => {
        
        if(!req.query.type){
            return ControllerErrorHelper.handle("Missing type parameter", res, "MeterController.getQuota", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
        if(!req.query.tenant_id){
            return ControllerErrorHelper.handle("Missing Tenant Id parameter", res, "MeterController.getQuota", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }

        const input = {
            type: req.query.type as string,
            tenant_id: req.query.tenant_id as UUID
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
    getAll = async(
        req: Request,
        res: Response
    ): Promise<Response> => {
        const page = Number(req.query.page ?? 1);
        const pageNumber = Number(req.query.pageNumber ?? 10);

        try{
            const event = await this.meterService.getAll(page, pageNumber);
            return res.status(200).json(event);
        } catch (err) {
            return ControllerErrorHelper.handle(err, res, "MeterController.getAll", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
}