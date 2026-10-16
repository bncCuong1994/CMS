import { useEffect, useState } from 'react';
import { type BiometricCapability, getBiometricCapability } from '@/lib/biometric';

/**
 * Hỏi khả năng sinh trắc của MÁY một lần khi mount (không phải fetch server →
 * dùng useEffect là đúng chỗ, giống việc nạp phiên/giảm chuyển động khi mở app).
 * `null` = chưa biết (chưa trả lời xong) → UI ẩn nút Face ID cho tới khi rõ.
 */
export function useBiometricCapability(): BiometricCapability | null {
  const [capability, setCapability] = useState<BiometricCapability | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getBiometricCapability().then((cap) => {
      if (!cancelled) setCapability(cap);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return capability;
}
