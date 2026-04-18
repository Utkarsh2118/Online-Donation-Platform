const AppError = require('../utils/AppError');

const handleCastErrorDB = (err) =>
  new AppError(`Invalid ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldsDB = (err) => {
  const duplicateField = Object.keys(err.keyValue || {})[0];
  const duplicateValue = err.keyValue?.[duplicateField];

  return new AppError(
    `Duplicate value for ${duplicateField}: ${duplicateValue}. Please use another value.`,
    409
  );
};

const handleValidationErrorDB = (err) => {
  const messages = Object.values(err.errors || {}).map((val) => val.message);
  return new AppError(`Invalid input data. ${messages.join('. ')}`, 400);
};

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired. Please log in again.', 401);

const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (!error.statusCode) {
    error = new AppError(error.message || 'Internal server error', 500);
  }

  if (err.name === 'CastError') {
    error = handleCastErrorDB(err);
  }

  if (err.code === 11000) {
    error = handleDuplicateFieldsDB(err);
  }

  if (err.name === 'ValidationError') {
    error = handleValidationErrorDB(err);
  }

  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  const statusCode = Number(error.statusCode) || 500;
  const status = error.status || (statusCode >= 400 && statusCode < 500 ? 'fail' : 'error');
  const message = error.message || err?.message || 'Internal server error';

  const payload = {
    success: false,
    status,
    message
  };

  if (process.env.NODE_ENV === 'development') {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
};

module.exports = {
  notFound,
  errorHandler
};
