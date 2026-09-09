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
router.post("/billing-metering/auth/sign-up", tenantController.createTenant);

/* ========================================================================== */
/* Tenant                                                                     */
/* ========================================================================== */

router.put("/billing-metering/tenant", tenantController.updateTenant);

router.delete("/billing-metering/tenant/:id", tenantController.removeTenant);

router.get("/billing-metering/tenant/:id", tenantController.findTenant);

router.get("/billing-metering/tenant", tenantController.getAll);

/* ========================================================================== */
/* Subscription                                                               */
/* ========================================================================== */

router.post("/billing-metering/subscription", subscriptionController.createSubscription);

router.put("/billing-metering/subscription/plan", subscriptionController.updateSubscriptionPlan);

router.put("/billing-metering/subscription/status", subscriptionController.changeSubsciptionStatus);

router.delete("/billing-metering/subscription/:id", subscriptionController.deleteSubscription);

router.get("/billing-metering/subscription/:id", subscriptionController.getSubsciption);

router.get("/billing-metering/subscription", subscriptionController.getAll)

/* ========================================================================== */
/* Metering                                                                   */
/* ========================================================================== */

router.post("/billing-metering/generate", meterController.generate);

router.get("/billing-metering/usage/:tenant_id", meterController.getUsage);

router.get("/billing-metering/get-quota/:tenant_id", meterController.getQuota);

router.get("/billing-metering/user-events", meterController.getAll);