const { AxiosError } = require('axios');

function readAxiosError (e, comment = '') {
  if (e instanceof AxiosError) {
    const error = `
      ${e.config.method} ${e.config.url}
      request data:
      ${e.config.data}
      response:
      ${e.response.status} ${e.response.statusText}
      response data:
      ${e.response.data}
      `
    console.log(`NOY_COMMENT: ${comment}`)
    console.log(data)
  } else {
    console.log('error is not an instance of AxiosError')
  }
}

function filterAxiosError (e, comment = '') {
  let error
  if (e instanceof AxiosError) {
    error = `${e.config.method} ${e.config.url}
            request data:
            ${e.config.data}
            response:
            ${e.response.status} ${e.response.statusText}
            response data:
            ${e.response.data}`
  } else {
    error = `Error is not an instance of AxiosError.`
  }

  if (comment) {
    error = `NOY_COMMENT: ${comment}/n` + error
  }
  // console.log(`NOY_COMMENT: ${comment}`)
  // console.log(data)
  throw new Error(error)
}


module.exports = { readAxiosError, filterAxiosError}