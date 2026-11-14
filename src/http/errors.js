// An error that is safe to show to the client. Anything else that reaches the
// error handler is treated as unexpected and answered with a generic 500.
export class HttpError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
