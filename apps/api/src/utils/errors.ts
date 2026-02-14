export class AppError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: this.error,
      message: this.message,
      statusCode: this.statusCode,
    };
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'Unauthorized', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'Forbidden', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'Not Found', message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(400, 'Bad Request', message);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message = 'External service error') {
    super(502, `${service} Error`, message);
  }
}
