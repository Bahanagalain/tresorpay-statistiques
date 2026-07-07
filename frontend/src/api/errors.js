export class ApiError extends Error {
  constructor(message, { status = 500, data = null, response = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.response = response;
  }
}
