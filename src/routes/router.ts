import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller';
import { TenantController } from '../controllers/tenant.controller';
import { MeterController } from '../controllers/metering.controller';

export const router = Router();

const subscriptionController = new SubscriptionController();
const tenantController = new TenantController();
const meterController = new MeterController();


/* ========================================================================== */
/* Auth                                                                       */
/* ========================================================================== */
router.post("/auth/sign-up", tenantController.createTenant);

/* ========================================================================== */
/* Tenant                                                                    */
/* ========================================================================== */

router.put("/tenant", tenantController.updateTenant);

router.delete("/tenant/:id", tenantController.removeTenant);

router.get("/tenant/:id", tenantController.findTenant)

/* ========================================================================== */
/* Subscription                                                                     */
/* ========================================================================== */

router.post("/subscription", subscriptionController.createSubscription);

router.put("/subscription/plan", subscriptionController.updateSubscriptionPlan);

router.put("/subscription/status", subscriptionController.changeSubsciptionStatus);

router.delete("/subscription/:id", subscriptionController.deleteSubscription);

router.get("/subscription/:id", subscriptionController.getSubsciption);

/* ========================================================================== */
/* Metering                                                                       */
/* ========================================================================== */

router.post("/generate", meterController.generate);

router.get("/get-quota", meterController.getQuota);