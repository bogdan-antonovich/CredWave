import { HttpException, HttpStatus } from '@nestjs/common';

export class ValidationException extends HttpException {
  constructor(message: string) {
    super(
      { error: { code: 'VALIDATION_ERROR', message } },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string) {
    super({ error: { code: 'NOT_FOUND', message } }, HttpStatus.NOT_FOUND);
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message: string) {
    super(
      { error: { code: 'INTERNAL_SERVER_ERROR', message } },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export class BadRequestException extends HttpException {
  constructor(message: string) {
    super({ error: { code: 'BAD_REQUEST', message } }, HttpStatus.BAD_REQUEST);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string) {
    super(
      { error: { code: 'UNAUTHORIZED', message } },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
