import type { Request, Response } from "express";
import type { UUID } from "node:crypto";
import { subscriptionCreateSchema, subscriptionChangeStatusSchema, subscriptionUpdatePlanSchema } from "../schemas";
import { ControllerErrorHelper } from "./helper";
import { SubscriptionService } from "../services/subscription.service";

export class SubscriptionController{
    constructor(
        private readonly subscriptionService = new SubscriptionService()
    ){}
    async createSubscription(
        req: Request,
        res: Response
    ): Promise<Response>{
        const result = subscriptionCreateSchema.safeParse(req.body);
        if (!result.success) {
            return ControllerErrorHelper.handle(result.error, res, "SubscriptionController.createSubscription", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }

        const input = {
            ...result.data,
            tenant_id: result.data.tenant_id as UUID,
            stripe_id: result.data.stripe_id as UUID
        }
        try{
            const event = await this.subscriptionService.create(input);
            return res.status(200).json(event);
        }catch(err){
            return ControllerErrorHelper.handle(err, res, "SubscriptionController.createSubscription", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
    async updateSubscriptionPlan(
        req: Request,
        res: Response
    ): Promise<Response>{
        const result = subscriptionUpdatePlanSchema.safeParse(req.body);
        if (!result.success) {
            return ControllerErrorHelper.handle(result.error, res, "SubscriptionController.updateSubscriptionPlan", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }

        const input = {
            ...result.data,
            sub_id: result.data.sub_id as UUID
        };
        try{
            const event = await this.subscriptionService.update_subscription_plan(input);
            return res.status(201).json(event);
        }catch(err){
            return ControllerErrorHelper.handle(err, res, "SubscriptionController.updateuSbscriptionPlan", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
    async changeSubsciptionStatus(
        req: Request,
        res: Response
    ): Promise<Response>{
        const result = subscriptionChangeStatusSchema.safeParse(req.body);
        if (!result.success) {
            return ControllerErrorHelper.handle(result.error, res, "SubscriptionController.changeSubscriptionStatus", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }

        const input = {
            ...result.data,
            sub_id: result.data.sub_id as UUID
        };
        try{
            const event = await this.subscriptionService.change_subscription_status(input);
            return res.status(201).json(event);
        }catch(err){
            return ControllerErrorHelper.handle(err, res, "SubscriptionController.changeSubscriptionStatus", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
    async deleteSubscription(
        req: Request,
        res: Response
    ): Promise<Response>{
        if(!req.params.id){
            return ControllerErrorHelper.handle("Missing id parameter", res, "SubscriptionController.deleteSubscription", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
        const id = req.params.id as UUID;
        try{
            const event = await this.subscriptionService.delete_subscription(id);
            return res.status(200).json(event);
        }catch(err){
            return ControllerErrorHelper.handle(err, res, "SubscriptionController.deleteSubscription", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
    async getSubsciption(
        req: Request,
        res: Response
    ): Promise<Response>{
        if(!req.params.id){
            return ControllerErrorHelper.handle("Missing id parameter", res, "SubscriptionController.dgetSubscription", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
        const id = req.params.id as UUID;
        try{
            const event = await this.subscriptionService.get_subscription(id);
            return res.status(200).json(event);
        }catch(err){
            return ControllerErrorHelper.handle(err, res, "SubscriptionController.getSubscription", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
    async getAll(
        req: Request,
        res: Response
    ): Promise<Response>{
        const page = Number(req.query.page ?? 1);
        const pageNumber = Number(req.query.pageNumber ?? 10);

        try{
            const event = await this.subscriptionService.getAll(page, pageNumber);
            return res.status(200).json(event);
        } catch (err) {
            return ControllerErrorHelper.handle(err, res, "SubscriptionController.getAll", {
                body: req.body,
                method: req.method,
                path: req.originalUrl,
            });
        }
    }
}