import { PinoLogger } from 'nestjs-pino';
import 'reflect-metadata';

const EXCLUDE_METADATA_KEY = Symbol('log_exclude');

export function Exclude(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const existing =
      (Reflect.getOwnMetadata(EXCLUDE_METADATA_KEY, target, propertyKey!) as
        | number[]
        | undefined) ?? [];
    existing.push(parameterIndex);
    Reflect.defineMetadata(
      EXCLUDE_METADATA_KEY,
      existing,
      target,
      propertyKey!,
    );
  };
}

export function LogMethods(): ClassDecorator {
  return (target) => {
    const proto = target.prototype as Record<string, unknown>;

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      const original = descriptor.value as (...args: unknown[]) => unknown;

      descriptor.value = function (
        this: { logger?: PinoLogger },
        ...args: unknown[]
      ): unknown {
        const excludedIndices =
          (Reflect.getOwnMetadata(EXCLUDE_METADATA_KEY, proto, key) as
            | number[]
            | undefined) ?? [];

        const scrubbedArgs = args.filter(
          (_, index) => !excludedIndices.includes(index),
        );

        this.logger?.debug({ args: scrubbedArgs }, `Method: ${key}`);

        return original.apply(this, args) as unknown;
      };

      Object.defineProperty(proto, key, descriptor);
    }
  };
}
