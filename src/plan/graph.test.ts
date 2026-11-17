import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFkGraph, insertOrder } from './graph.ts';
import type { Catalog } from './types.ts';

const catalog: Catalog = {
  tables: [
    { name: 'users', primaryKey: ['id'] },
    { name: 'orders', primaryKey: ['id'] },
    { name: 'order_items', primaryKey: ['id'] },
  ],
  columns: [],
  foreignKeys: [
    {
      name: 'orders_user_id_fkey',
      fromTable: 'orders',
      fromColumns: ['user_id'],
      toTable: 'users',
      toColumns: ['id'],
    },
    {
      name: 'order_items_order_id_fkey',
      fromTable: 'order_items',
      fromColumns: ['order_id'],
      toTable: 'orders',
      toColumns: ['id'],
    },
  ],
};

test('buildFkGraph links parents and children', () => {
  const { childrenOf, parentsOf } = buildFkGraph(catalog);
  assert.equal(childrenOf.get('users')?.length, 1);
  assert.equal(childrenOf.get('orders')?.length, 1);
  assert.equal(parentsOf.get('orders')?.[0]?.toTable, 'users');
  assert.equal(parentsOf.get('order_items')?.[0]?.toTable, 'orders');
});

test('insertOrder puts parents before children', () => {
  assert.deepEqual(insertOrder(catalog), ['users', 'orders', 'order_items']);
});

test('insertOrder rejects FK cycles', () => {
  const cyclic: Catalog = {
    tables: [
      { name: 'a', primaryKey: ['id'] },
      { name: 'b', primaryKey: ['id'] },
    ],
    columns: [],
    foreignKeys: [
      { name: 'a_b', fromTable: 'a', fromColumns: ['b_id'], toTable: 'b', toColumns: ['id'] },
      { name: 'b_a', fromTable: 'b', fromColumns: ['a_id'], toTable: 'a', toColumns: ['id'] },
    ],
  };
  assert.throws(() => insertOrder(cyclic), /cycle/i);
});
