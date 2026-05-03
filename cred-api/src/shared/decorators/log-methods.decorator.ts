import { PinoLogger } from 'nestjs-pino';

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
        this.logger?.debug({ args }, key);
        return original.apply(this, args) as unknown;
      };

      Object.defineProperty(proto, key, descriptor);
    }
  };
}
