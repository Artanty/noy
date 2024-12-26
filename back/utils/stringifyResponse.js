function stringifyResponse (data) {
  data = JSON.stringify(data)
  data = data.replace(/'/g, '"');
  data = data.replace(/"/g, '\\"');
  return data
}

module.exports = stringifyResponse