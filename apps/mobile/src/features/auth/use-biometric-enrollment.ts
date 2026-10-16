import { useCallback } from 'react';
import { Alert } from 'react-native';
import { authenticate, biometricLabel, getBiometricCapability } from '@/lib/biometric';
import { useAuthStore } from './auth-store';

/**
 * Mời bật Face ID sau khi đăng nhập bằng mật khẩu thành công (AC2/AC3).
 *
 * Trình tự khi gọi `offerEnrollment()`:
 * 1. Chưa bật + máy có phần cứng & đã đăng ký sinh trắc (AC2) → hỏi "Bật …?".
 *    Máy không hỗ trợ / chưa đăng ký (AC9) → bỏ qua, không hỏi.
 * 2. Chọn "Bật" → authenticate(); thành công → lưu refresh token gated + cờ (AC3).
 *    Huỷ/thất bại → không bật, không lưu gì thêm, vào app bình thường (AC3).
 */
export function useBiometricEnrollment() {
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const enableBiometric = useAuthStore((s) => s.enableBiometric);

  const offerEnrollment = useCallback(async (): Promise<void> => {
    if (biometricEnabled) return;

    const cap = await getBiometricCapability();
    if (!cap.isAvailable) return; // AC9

    const label = biometricLabel(cap.types);

    const wantsEnable = await new Promise<boolean>((resolve) => {
      Alert.alert(
        `Bật đăng nhập bằng ${label}?`,
        `Lần sau mở app, bạn có thể đăng nhập nhanh bằng ${label} mà không cần gõ mật khẩu.`,
        [
          { text: 'Để sau', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Bật', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
    if (!wantsEnable) return;

    const unlocked = await authenticate(`Xác thực để bật đăng nhập bằng ${label}`);
    if (!unlocked) return; // AC3: huỷ/thất bại → không bật

    await enableBiometric();
  }, [biometricEnabled, enableBiometric]);

  return { offerEnrollment };
}
