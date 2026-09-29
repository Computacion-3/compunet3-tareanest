import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';

import { AppLogger } from '../logger/logger.service';

interface TraceableRequest extends Request {
    correlationId: string;
}

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
    constructor(private readonly logger: AppLogger) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<unknown> {
        const httpContext = context.switchToHttp();

        const request = httpContext.getRequest<TraceableRequest>();
        const response = httpContext.getResponse<Response>();

        const incomingCorrelationId =
            request.headers['x-correlation-id'];

        const correlationId =
            typeof incomingCorrelationId === 'string' &&
            incomingCorrelationId.trim() !== ''
                ? incomingCorrelationId
                : randomUUID();

        request.correlationId = correlationId;

        response.setHeader(
            'x-correlation-id',
            correlationId,
        );

        const startTime = Date.now();

        return next.handle().pipe(
            finalize(() => {
                const duration = Date.now() - startTime;

                const statusCode = response.statusCode;

                const statusText =
                    statusCode === 200
                        ? 'OK'
                        : statusCode === 201
                          ? 'Created'
                          : statusCode === 204
                            ? 'No Content'
                            : '';

                this.logger.logWithTrace(
                    correlationId,
                    'TRACE',
                    `[${request.method} ${request.originalUrl}] ` +
                        `[${statusCode} ${statusText}] ` +
                        `[Duration: ${duration}ms]`,
                );
            }),
        );
    }
}