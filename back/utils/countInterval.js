/**
 * Получает шаг (через сколько минут запускаться).
 * Отдает конкретные минуты в часе, по которым будут проводиться job.
 * Пример: input 10, output: [10,20,30,40,50,60]
 * @param {number} step 
 * @returns {number[]}
 */
function countInterval (step) {
  const result = []
  let min = 0
  while(min <= 60) {
    result.push(min)
    min += step
  }
  return result
}

module.exports = countInterval