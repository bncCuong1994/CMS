import { useEffect, useState } from 'react';

/** Trả về giá trị đã trễ `delay` ms so với `value`; dùng cho ô tìm kiếm. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
