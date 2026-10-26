// Парсинг и форматирование денег в копейках (чистый модуль)

export const MAX_MONEY_KOPECKS = 9999999999; // 99 999 999,99 ₽

/**
 * Парсит строку ввода денег в целое число копеек.
 * Возвращает null при некорректной строке или превышении лимита.
 * Пустая строка (или строка только из пробелов) трактуется как 0.
 * @param {string} str
 * @returns {number | null}
 */
export function parseMoney(str) {
  if (typeof str !== 'string') return null;

  // Игнорируем пробелы (включая неразрывные) и символ ₽
  const clean = str.replace(/[\s\u00A0\u202F₽]/g, '');

  if (clean === '') {
    return 0;
  }

  // Допускаем только неотрицательные числа с максимум одним разделителем (. или ,)
  // и не более 2 знаков после разделителя
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) {
    return null;
  }

  const parts = clean.split(/[.,]/);
  const rublesStr = parts[0];
  const centsStr = parts[1] || '';

  const rubles = parseInt(rublesStr, 10);
  if (!Number.isSafeInteger(rubles)) {
    return null;
  }

  let cents = 0;
  if (centsStr.length === 1) {
    cents = parseInt(centsStr, 10) * 10;
  } else if (centsStr.length === 2) {
    cents = parseInt(centsStr, 10);
  }

  const total = rubles * 100 + cents;
  if (total > MAX_MONEY_KOPECKS) {
    return null;
  }

  return total;
}

/**
 * Форматирует копейки в строку по локали ru-RU:
 * пробел как разделитель тысяч, запятая в дробной части, всегда два знака, символ ₽.
 * Для отрицательных значений используется знак «−» (\u2212).
 * Например: 130667 -> "1 306,67 ₽", -84667 -> "−846,67 ₽", 0 -> "0,00 ₽"
 * @param {number} kopecks
 * @returns {string}
 */
export function formatMoney(kopecks) {
  if (typeof kopecks !== 'number' || !Number.isFinite(kopecks)) {
    return '0,00 ₽';
  }

  const isNegative = kopecks < 0;
  const abs = Math.abs(Math.round(kopecks));

  const rubles = Math.floor(abs / 100);
  const cents = abs % 100;

  // Пробел как разделитель тысяч
  const rublesFormatted = rubles.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const centsFormatted = cents < 10 ? `0${cents}` : cents.toString();

  const sign = isNegative ? '−' : '';
  return `${sign}${rublesFormatted},${centsFormatted} ₽`;
}
