// Расчёт чеков, балансов, переводов, валидация (чистый модуль)
import { MAX_MONEY_KOPECKS } from './money.js';

/**
 * Проверяет валидность одного чека по правилам раздела 5.4 спецификации.
 * @param {object} receipt
 * @param {Array<{id: string, name: string}>} participants
 * @returns {{
 *   isValid: boolean,
 *   isFresh: boolean,
 *   errors: {
 *     payer?: string,
 *     amount?: string,
 *     shared?: string,
 *     personalExceeds?: string,
 *     personal?: Record<string, { person?: string, amount?: string }>
 *   },
 *   personalTotal: number,
 *   sharedPart: number
 * }}
 */
export function validateReceipt(receipt, participants = []) {
  const errors = {};
  const participantIds = new Set(participants.map((p) => p.id));

  const isFresh =
    (!receipt.amount || receipt.amount === 0) &&
    !receipt.payerId &&
    (!receipt.personal || receipt.personal.length === 0);

  // 1. Плательщик
  if (!receipt.payerId || !participantIds.has(receipt.payerId)) {
    errors.payer = 'receiptPayerRequired';
  }

  // 2. Сумма чека
  if (
    typeof receipt.amount !== 'number' ||
    !Number.isInteger(receipt.amount) ||
    receipt.amount <= 0 ||
    receipt.amount > MAX_MONEY_KOPECKS
  ) {
    errors.amount = 'receiptAmountRequired';
  }

  // 3. Личные покупки
  let personalTotal = 0;
  const personalErrors = {};

  if (Array.isArray(receipt.personal)) {
    for (const item of receipt.personal) {
      const itemErr = {};
      if (!item.personId || !participantIds.has(item.personId)) {
        itemErr.person = 'receiptPersonalOwnerRequired';
      }
      if (
        typeof item.amount !== 'number' ||
        !Number.isInteger(item.amount) ||
        item.amount <= 0 ||
        item.amount > MAX_MONEY_KOPECKS
      ) {
        itemErr.amount = 'receiptPersonalAmountRequired';
      } else {
        personalTotal += item.amount;
      }

      if (Object.keys(itemErr).length > 0) {
        personalErrors[item.id] = itemErr;
      }
    }
  }

  if (Object.keys(personalErrors).length > 0) {
    errors.personal = personalErrors;
  }

  const receiptAmount = typeof receipt.amount === 'number' && receipt.amount > 0 ? receipt.amount : 0;

  // 4. Личные покупки не больше суммы чека
  if (personalTotal > receiptAmount && receiptAmount > 0) {
    errors.personalExceeds = 'receiptPersonalExceeds';
  }

  const sharedPart = Math.max(0, receiptAmount - personalTotal);

  // 5. В sharedWith нет несуществующих участников
  const validSharedWith = Array.isArray(receipt.sharedWith)
    ? receipt.sharedWith.filter((id) => participantIds.has(id))
    : [];

  if (Array.isArray(receipt.sharedWith) && receipt.sharedWith.length !== validSharedWith.length) {
    errors.shared = 'receiptSharedInvalid';
  }

  // 6. Если sharedPart > 0, то в sharedWith есть хотя бы один существующий участник
  if (sharedPart > 0 && validSharedWith.length === 0) {
    errors.shared = 'receiptSharedEmpty';
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    isFresh,
    errors,
    personalTotal,
    sharedPart
  };
}

/**
 * Рассчитывает событие: балансы участников, сводную статистику и список переводов.
 * @param {object} event
 * @returns {{
 *   validReceiptsCount: number,
 *   totalReceiptsCount: number,
 *   errorReceiptsCount: number,
 *   participantStats: Array<{
 *     id: string,
 *     name: string,
 *     spent: number,
 *     paid: number,
 *     balance: number
 *   }>,
 *   transfers: Array<{
 *     fromId: string,
 *     fromName: string,
 *     toId: string,
 *     toName: string,
 *     amount: number
 *   }>
 * }}
 */
export function calculateEvent(event) {
  const participants = Array.isArray(event?.participants) ? event.participants : [];
  const receipts = Array.isArray(event?.receipts) ? event.receipts : [];

  const participantMap = new Map();
  participants.forEach((p, index) => {
    participantMap.set(p.id, {
      id: p.id,
      name: p.name,
      orderIndex: index,
      spent: 0,
      paid: 0,
      balance: 0
    });
  });

  let validReceiptsCount = 0;
  let errorReceiptsCount = 0;

  for (const receipt of receipts) {
    const val = validateReceipt(receipt, participants);
    if (!val.isValid) {
      errorReceiptsCount++;
      continue;
    }

    validReceiptsCount++;

    // Плательщик заплатил amount
    const payer = participantMap.get(receipt.payerId);
    if (payer) {
      payer.paid += receipt.amount;
    }

    // Личные покупки
    if (Array.isArray(receipt.personal)) {
      for (const item of receipt.personal) {
        const owner = participantMap.get(item.personId);
        if (owner) {
          owner.spent += item.amount;
        }
      }
    }

    // Общая часть делится поровну между участниками из sharedWith
    // Порядок определяется порядком в participants события!
    const sharedParticipants = participants.filter((p) =>
      receipt.sharedWith.includes(p.id)
    );

    const n = sharedParticipants.length;
    if (val.sharedPart > 0 && n > 0) {
      const baseShare = Math.floor(val.sharedPart / n);
      const remainder = val.sharedPart % n;

      sharedParticipants.forEach((p, idx) => {
        const share = baseShare + (idx < remainder ? 1 : 0);
        const stat = participantMap.get(p.id);
        if (stat) {
          stat.spent += share;
        }
      });
    }
  }

  // Считаем балансы: заплатил − потратил на себя
  // Положительный баланс: ему должны. Отрицательный: должен он.
  const participantStats = participants.map((p) => {
    const stat = participantMap.get(p.id);
    stat.balance = stat.paid - stat.spent;
    return {
      id: stat.id,
      name: stat.name,
      spent: stat.spent,
      paid: stat.paid,
      balance: stat.balance
    };
  });

  // Расчёт переводов (жадный алгоритм, раздел 5.2)
  const debtors = [];
  const creditors = [];

  participantStats.forEach((p, index) => {
    if (p.balance < 0) {
      debtors.push({
        id: p.id,
        name: p.name,
        amount: -p.balance,
        orderIndex: index
      });
    } else if (p.balance > 0) {
      creditors.push({
        id: p.id,
        name: p.name,
        amount: p.balance,
        orderIndex: index
      });
    }
  });

  const transfers = [];

  while (debtors.length > 0 && creditors.length > 0) {
    // Сортируем должников по убыванию суммы долга, при равенстве по orderIndex
    debtors.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.orderIndex - b.orderIndex;
    });

    // Сортируем кредиторов по убыванию суммы требования, при равенстве по orderIndex
    creditors.sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.orderIndex - b.orderIndex;
    });

    const debtor = debtors[0];
    const creditor = creditors[0];

    const transferAmount = Math.min(debtor.amount, creditor.amount);

    transfers.push({
      fromId: debtor.id,
      fromName: debtor.name,
      toId: creditor.id,
      toName: creditor.name,
      amount: transferAmount
    });

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount === 0) {
      debtors.shift();
    }
    if (creditor.amount === 0) {
      creditors.shift();
    }
  }

  return {
    validReceiptsCount,
    totalReceiptsCount: receipts.length,
    errorReceiptsCount,
    participantStats,
    transfers
  };
}
