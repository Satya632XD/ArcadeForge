function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}

function errorHandler(error, req, res, next) {
  console.error(error);
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  const code = error.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = status === 500 ? 'Internal server error.' : error.message;
  res.status(status).json({ error: { code, message } });
}

function fail(status, message, code = 'BAD_REQUEST') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

module.exports = { notFound, errorHandler, fail };
