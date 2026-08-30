import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller.ts';
import { TenantController } from '../controllers/tenant.controller.ts';
import { MeterController } from '../controllers/metering.controller.ts';

export const router = Router();

const subscriptionController = new SubscriptionController();
const tenantController = new TenantController();
const meterController = new MeterController();


/* ========================================================================== */
/* Auth                                                                       */
/* ========================================================================== */
router.post("/auth/sign-up", tenantController.createTenant);

/* ========================================================================== */
/* Tenant                                                                     */
/* ========================================================================== */

router.put("/tenant", tenantController.updateTenant);

router.delete("/tenant/:id", tenantController.removeTenant);

router.get("/tenant/:id", tenantController.findTenant);

router.get("/tenant", tenantController.getAll);

/* ========================================================================== */
/* Subscription                                                               */
/* ========================================================================== */

router.post("/subscription", subscriptionController.createSubscription);

router.put("/subscription/plan", subscriptionController.updateSubscriptionPlan);

router.put("/subscription/status", subscriptionController.changeSubsciptionStatus);

router.delete("/subscription/:id", subscriptionController.deleteSubscription);

router.get("/subscription/:id", subscriptionController.getSubsciption);

router.get("/subscription", subscriptionController.getAll)

/* ========================================================================== */
/* Metering                                                                       */
/* ========================================================================== */

router.post("/generate", meterController.generate);

router.get("/get-quota", meterController.getQuota);

router.get("/user-events", meterController.getAll);