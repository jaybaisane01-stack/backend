export const errorHandler = (err, req, res, next) => {
  console.error(`[Error]: ${err.message}`);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only send stack trace in development
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};