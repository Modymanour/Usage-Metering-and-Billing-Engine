import assert from 'node:assert/strict';
import test from 'node:test';

import { CostService } from '../src/services/cost.service';

const costService = new CostService();

test('cost service calculates per-token pricing and totals in cents', () => {
    const result = costService.calculateAICost({
        inputTokens: 1_000_000,
        cachedInputTokens: 500_000,
        outputTokens: 2_000_000,
        reasoningTokens: 1_000_000,
    });

    assert.deepEqual(result, {
        inputCostCents: 100,
        cachedInputCostCents: 5,
        outputCostCents: 600,
        reasoningCostCents: 300,
        totalCostCents: 1005,
    });
});

test('cost service calculates api call cost using the configured per-call price', () => {
    assert.equal(costService.calculateApiCost(0), 0);
    assert.equal(costService.calculateApiCost(7), 7);
    assert.equal(costService.calculateApiCost(42), 42);
});

test('cost service keeps zero usage at zero cost', () => {
    const result = costService.calculateAICost({
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
    });

    assert.deepEqual(result, {
        inputCostCents: 0,
        cachedInputCostCents: 0,
        outputCostCents: 0,
        reasoningCostCents: 0,
        totalCostCents: 0,
    });
});
