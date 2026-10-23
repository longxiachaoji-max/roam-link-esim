import assert from 'node:assert/strict';
import test from 'node:test';
import { toMemberTransactionReason } from '../src/lib/member-transaction-reason.ts';

test('hides admin top-up notes and received amount', () => {
  assert.equal(toMemberTransactionReason('[收款金額:500] 客戶 LINE 轉帳，補償上次斷線', 500), '儲值');
  assert.equal(toMemberTransactionReason('[收款金額:0] 扣回重複儲值', -300), '儲值金調整');
});

test('hides legacy admin notes without the received amount tag', () => {
  assert.equal(toMemberTransactionReason('朋友優惠 VIP', 200), '儲值');
  assert.equal(toMemberTransactionReason('', 200), '儲值');
  assert.equal(toMemberTransactionReason(null, -50), '儲值金調整');
});

test('shows online top-ups without internal order ids or admin markers', () => {
  assert.equal(
    toMemberTransactionReason('[收款金額:1000] 一飛通綠界儲值（後台確認） 訂單:7f0c9c1e-0000-4000-8000-000000000000', 1000),
    '線上刷卡儲值'
  );
  assert.equal(toMemberTransactionReason('[收款金額:500] 一飛通超商儲值 訂單:abc', 500), '超商代碼儲值');
});

test('keeps system generated descriptions', () => {
  assert.equal(toMemberTransactionReason('購買 eSIM (訂單 FRL20261023001)', -299), '購買 eSIM (訂單 FRL20261023001)');
  assert.equal(toMemberTransactionReason('一飛通商城儲值金結帳 (訂單 1a2b3c4d)', -1200), '一飛通商城儲值金結帳 (訂單 1a2b3c4d)');
  assert.equal(toMemberTransactionReason('兌換代碼: WELCOME100', 100), '兌換代碼: WELCOME100');
  assert.equal(toMemberTransactionReason('推薦碼 ABC123 訂單回饋', 30), '推薦碼 ABC123 訂單回饋');
  assert.equal(toMemberTransactionReason('儲值推薦碼 ABC123 儲值回饋', 50), '儲值推薦碼 ABC123 儲值回饋');
});

test('does not leak a note appended after a system-looking prefix', () => {
  assert.equal(toMemberTransactionReason('購買 eSIM (訂單 X) 客戶很難搞', -100), '儲值金調整');
});
