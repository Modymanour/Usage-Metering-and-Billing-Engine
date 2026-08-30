import type { Request, Response } from "express";
import type { UUID } from "node:crypto";
import { tenantUpdateSchema, registerSchema } from "../schemas";
import { ControllerErrorHelper } from "./helper.ts";
import { TenantsService } from "../services/tenants.service.ts";

export class TenantController{
    constructor(
        private readonly tenantService = new TenantsService()
    ){}

    createTenant = async (
        req: Request,
        res: Response
    ): Promise<Response> => {
        const result = registerSchema.safeParse(req.body);

        if(!result.success){
            return ControllerErrorHelper.handle(result.error, res, "TenantController.createTenant", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
        try{
            const event = await this.tenantService.create(result.data)
            return res.status(200).json(event)
        } catch(err){
            return ControllerErrorHelper.handle(err, res, "TenantController.createTenant", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
    updateTenant = async(
        req: Request,
        res: Response
    ): Promise<Response> => {
        const result = tenantUpdateSchema.safeParse(req.body);

        if(!result.success){
            return ControllerErrorHelper.handle(result.error, res, "TenantController.updateTenant", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
        const input = {
            ...result.data,
            id: result.data.id as UUID
        }

        try{
            const event = await this.tenantService.update(input);
            return res.status(201).json(event);
        }catch(err){
            return ControllerErrorHelper.handle(err, res, "TenantController.updateTenant", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
    findTenant = async(
        req: Request,
        res: Response
    ): Promise<Response> => {
        if(!req.params.id){
            return ControllerErrorHelper.handle("id not found", res, "TenantController.findTenant", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
        const id  = req.params.id as UUID;
        try{
            const event = await this.tenantService.findById(id);
            return res.status(200).json(event);
        }catch(err){
            return ControllerErrorHelper.handle(err, res, "TenantController.findTenant", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
    removeTenant = async(
        req: Request,
        res: Response
    ): Promise<Response> => {
        if(!req.params.id){
            return ControllerErrorHelper.handle("id not found", res, "TenantController.removeTenant", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
        const id  = req.params.id as UUID;
        try{
            const event = await this.tenantService.remove(id);
            return res.status(200).json(event);
        }catch(err){
            return ControllerErrorHelper.handle(err, res, "TenantController.removeTenant", {
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
            const event = await this.tenantService.getAll(page, pageNumber);
            return res.status(200).json(event);
        } catch (err) {
            return ControllerErrorHelper.handle(err, res, "TenantController.getAll", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
}