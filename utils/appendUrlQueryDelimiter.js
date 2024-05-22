function appendUrlQueryDelimiter(str) {
  if (str.includes('?')) {
    return str + '&';
  } else {
    return str + '?';
  }
}

module.exports = appendUrlQueryDelimiter