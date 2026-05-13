import { PinoLogger } from 'nestjs-pino';

export function LogMethods(exclude: string[] = []): ClassDecorator {
  return (target) => {
    const proto = target.prototype as Record<string, unknown>;

    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);

      // Ensure we are only wrapping actual methods
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      const original = descriptor.value as (...args: unknown[]) => unknown;

      descriptor.value = function (
        this: { logger?: PinoLogger },
        ...args: unknown[]
      ): unknown {
        const scrubbedArgs = args.map((arg) => {
          // Check if it's a non-null object
          if (arg !== null && typeof arg === 'object' && !Array.isArray(arg)) {
            // Use spread to create a shallow copy safely
            const copy = { ...(arg as Record<string, unknown>) };

            for (const keyToHide of exclude) {
              if (keyToHide in copy) {
                copy[keyToHide] = '[REDACTED]';
              }
            }
            return copy;
          }
          return arg;
        });

        this.logger?.debug({ args: scrubbedArgs }, `Method: ${key}`);

        return original.apply(this, args) as unknown;
      };

      Object.defineProperty(proto, key, descriptor);
    }
  };
}
