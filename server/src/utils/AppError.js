/**
 * An error that is safe to show to the user.
 * `code` is a stable machine-readable string the frontend can switch on.
 */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const Errors = {
  badRequest: (code, message, details) => new AppError(400, code, message, details),
  unauthorized: (message = 'Please log in to continue.') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have access to this resource.') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message),
  conflict: (code, message) => new AppError(409, code, message),
  llmUnavailable: (message = 'The AI service is temporarily unavailable. Please try again in a moment.') =>
    new AppError(503, 'LLM_UNAVAILABLE', message),
};
