import { describe, it } from 'node:test';
import assert from 'node:assert';
import { confirmChallan } from './challanConfirm';

// In-memory stand-in for Prisma with real-database concurrency semantics:
// every operation yields to the event loop first (so two concurrent
// confirmChallan calls interleave exactly like two concurrent HTTP requests),
// while updateMany's check-and-set runs synchronously and is therefore atomic,
// like a single SQL UPDATE ... WHERE status = 'Draft'.
function createFakePrisma() {
  const state = {
    challans: new Map([
      [
        'challan-1',
        {
          id: 'challan-1',
          challanNumber: 'CH-2026-0001',
          status: 'Draft',
          createdBy: 'user-1',
          lineItems: [{ productId: 'product-1', quantity: 3 }],
        },
      ],
    ]),
    products: new Map([
      ['product-1', { id: 'product-1', name: 'Widget', currentStock: 10 }],
    ]),
    movements: [] as { productId: string; quantityChanged: number }[],
  };

  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

  interface FakeTx {
    product: {
      findUnique(args: any): Promise<any>;
      update(args: any): Promise<any>;
    };
    stockMovement: {
      create(args: any): Promise<any>;
    };
    challan: {
      updateMany(args: any): Promise<{ count: number }>;
      update(args: any): Promise<any>;
      findUnique(args: any): Promise<any>;
    };
  }

  const tx: FakeTx = {
    product: {
      async findUnique({ where }: any) {
        await tick();
        return state.products.get(where.id) ?? null;
      },
      async update({ where, data }: any) {
        await tick();
        const product = state.products.get(where.id)!;
        product.currentStock += data.currentStock.decrement
          ? -data.currentStock.decrement
          : data.currentStock;
        return product;
      },
    },
    stockMovement: {
      async create({ data }: any) {
        await tick();
        state.movements.push({
          productId: data.productId,
          quantityChanged: data.quantityChanged,
        });
        return data;
      },
    },
    challan: {
      // Atomic compare-and-swap: no await between the status check and the
      // write, so concurrent transactions cannot both observe Draft.
      async updateMany({ where, data }: any) {
        await tick();
        const challan = state.challans.get(where.id);
        if (challan && challan.status === where.status) {
          challan.status = data.status;
          return { count: 1 };
        }
        return { count: 0 };
      },
      async update({ where, data }: any) {
        await tick();
        const challan = state.challans.get(where.id)!;
        Object.assign(challan, data);
        return challan;
      },
      async findUnique({ where }: any) {
        await tick();
        return state.challans.get(where.id) ?? null;
      },
    },
  };

  return {
    state,
    client: {
      challan: {
        async findUnique({ where }: any) {
          await tick();
          return state.challans.get(where.id) ?? null;
        },
      },
      // Shared state across concurrent transactions (read-committed-like).
      // A throwing transaction undoes only its own writes via a per-tx undo
      // log, like a real rollback: before-images are captured at the moment
      // this transaction writes, so restoring them cannot clobber another
      // transaction's committed changes.
      async $transaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T> {
        const undoStatuses = new Map<string, string>();
        const undoStocks = new Map<string, number>();
        let createdMovements = 0;
        const trackedTx: FakeTx = {
          product: {
            findUnique: tx.product.findUnique,
            async update(args: any) {
              if (!undoStocks.has(args.where.id)) {
                undoStocks.set(args.where.id, state.products.get(args.where.id)!.currentStock);
              }
              return tx.product.update(args);
            },
          },
          stockMovement: {
            async create(args: any) {
              createdMovements += 1;
              return tx.stockMovement.create(args);
            },
          },
          challan: {
            async updateMany(args: any) {
              const result = await tx.challan.updateMany(args);
              // Only a matched row was actually written; its before-image is
              // the status the WHERE clause matched on.
              if (result.count > 0 && !undoStatuses.has(args.where.id)) {
                undoStatuses.set(args.where.id, args.where.status);
              }
              return result;
            },
            async update(args: any) {
              const challan = state.challans.get(args.where.id)!;
              if (!undoStatuses.has(challan.id)) {
                undoStatuses.set(challan.id, challan.status);
              }
              return tx.challan.update(args);
            },
            findUnique: tx.challan.findUnique,
          },
        };
        try {
          return await fn(trackedTx);
        } catch (error) {
          for (const [id, status] of undoStatuses) {
            state.challans.get(id)!.status = status;
          }
          for (const [id, stock] of undoStocks) {
            state.products.get(id)!.currentStock = stock;
          }
          state.movements.splice(state.movements.length - createdMovements, createdMovements);
          throw error;
        }
      },
    },
  };
}

describe('concurrent challan confirmation', () => {
  it('decrements stock exactly once when two confirms race', async () => {
    const { state, client } = createFakePrisma();
    const user = { userId: 'user-1', role: 'Admin' };

    const outcomes = await Promise.allSettled([
      confirmChallan(client, 'challan-1', user),
      confirmChallan(client, 'challan-1', user),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');

    // Exactly one confirm wins; the loser is told the challan is no longer a draft.
    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);
    assert.match(
      (rejected[0] as PromiseRejectedResult).reason.message,
      /Only draft challans can be confirmed/
    );

    // Stock was decremented once (10 -> 7), not twice (10 -> 4).
    assert.strictEqual(state.products.get('product-1')!.currentStock, 7);
    assert.strictEqual(state.movements.length, 1);
    assert.strictEqual(state.challans.get('challan-1')!.status, 'Confirmed');
  });
});
