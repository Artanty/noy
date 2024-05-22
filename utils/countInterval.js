function countInterval (step) {
  const result = []
  let min = 0
  while(min < 60) {
    result.push(min)
    min += step
  }
  return result
}

module.exports = countInterval