import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Cổng sinh trắc LOCAL (expo-local-authentication) cho Face ID ĐĂNG NHẬP lại app.
 * - Chỉ trả đúng/sai việc "chủ thiết bị xác thực"; KHÔNG chứng minh danh tính với
 *   server, KHÔNG lưu/gửi dữ liệu sinh trắc.
 * - Fallback passcode của OS bị TẮT (disableDeviceFallback) để không mở bằng mã mở
 *   máy thay cho sinh trắc.
 * - Face ID đăng nhập KHÁC Face ID chấm công (US-ATT-04) — không đụng device binding.
 */

export interface BiometricCapability {
  /** Máy có phần cứng sinh trắc. */
  hasHardware: boolean;
  /** Người dùng đã đăng ký sinh trắc ở OS. */
  isEnrolled: boolean;
  /** Dùng được = có phần cứng VÀ đã đăng ký. */
  isAvailable: boolean;
  /** Loại sinh trắc máy hỗ trợ (để chọn nhãn: Face ID / Touch ID / vân tay). */
  types: LocalAuthentication.AuthenticationType[];
}

/** Hỏi khả năng sinh trắc của máy (AC2/AC9). Lỗi native → coi như không khả dụng. */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    return { hasHardware, isEnrolled, isAvailable: hasHardware && isEnrolled, types };
  } catch {
    return { hasHardware: false, isEnrolled: false, isAvailable: false, types: [] };
  }
}

/**
 * Nhãn hiển thị theo loại sinh trắc máy hỗ trợ (AC3 giả định #3, AC11).
 * Ưu tiên Face ID (gồm Optic ID) → Touch ID → mặc định "sinh trắc".
 */
export function biometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'Face ID';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'vân tay';
  }
  return 'sinh trắc';
}

/**
 * Yêu cầu người dùng xác thực sinh trắc. Trả true nếu thành công.
 * disableDeviceFallback: true → không cho dùng mã mở máy thay sinh trắc.
 * Mọi thất bại/huỷ → false (AC5); KHÔNG ném để không lộ lỗi hệ thống ra UI.
 */
export async function authenticate(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: true,
      cancelLabel: 'Huỷ',
    });
    return result.success;
  } catch {
    return false;
  }
}
