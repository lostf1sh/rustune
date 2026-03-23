export function throttle<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;
    if (!timer) {
      fn(...args);
      timer = setTimeout(() => {
        timer = null;
        if (lastArgs) fn(...lastArgs);
      }, ms);
    }
  };
}
