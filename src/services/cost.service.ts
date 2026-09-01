import { PRICING } from "../config/pricing.config";

export interface AITokenUsage {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
}

export interface CostBreakdown {
    inputCostCents: number;
    cachedInputCostCents: number;
    outputCostCents: number;
    reasoningCostCents: number;
    totalCostCents: number;
}

export class CostService {

    calculateAICost(usage: AITokenUsage): CostBreakdown{

        const inputCost =
            usage.inputTokens *
            PRICING.ai.inputPerMillionTokensCents /
            1_000_000;

        const cachedInputCost =
            usage.cachedInputTokens *
            PRICING.ai.cachedInputPerMillionTokensCents /
            1_000_000;

        const outputCost =
            usage.outputTokens *
            PRICING.ai.outputPerMillionTokensCents /
            1_000_000;

        const reasoningCost =
            usage.reasoningTokens *
            PRICING.ai.outputPerMillionTokensCents /
            1_000_000;

        const totalCost = Math.round(
            inputCost +
            cachedInputCost +
            outputCost +
            reasoningCost
        );
        return {
            inputCostCents: inputCost,
            cachedInputCostCents: cachedInputCost,
            outputCostCents: outputCost,
            reasoningCostCents: reasoningCost,
            totalCostCents: totalCost
        };
    }

    calculateApiCost(quantity: number): number{
        return quantity * PRICING.apiCall.perCallCents;
    }
}