import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';
import { FormField } from '@/components/FormField';
import { AlertIcon, ArrowRightIcon, FaceIdIcon } from '@/components/icons';
import { ApiError } from '@/lib/api-error';
import { biometricLabel } from '@/lib/biometric';
import { brand } from '@/lib/brand';
import { useAuthStore } from './auth-store';
import { useBiometricCapability } from './use-biometric-capability';
import { useBiometricEnrollment } from './use-biometric-enrollment';
import { useBiometricLogin } from './use-biometric-login';
import { useLogin } from './use-login';

const SESSION_EXPIRED_MESSAGE = 'Phiên đã hết hạn, vui lòng đăng nhập lại bằng mật khẩu';

const loginSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  /** Gọi khi đăng nhập thành công (điều hướng về Trang chủ). */
  onSuccess?: () => void;
  /** true khi đang nhập mật khẩu ở chế độ ẩn → logo panda che mắt. */
  onCoverEyesChange?: (cover: boolean) => void;
  /** Gọi mỗi lần API đăng nhập trả lỗi → logo panda lắc đầu. */
  onLoginFailed?: () => void;
}

/** Báo tính năng chưa làm (giữ chỗ trên giao diện theo yêu cầu, sẽ nối ở story sau). */
function comingSoon(feature: string) {
  Alert.alert(feature, 'Tính năng đang được phát triển.');
}

export function LoginForm({ onSuccess, onCoverEyesChange, onLoginFailed }: LoginFormProps) {
  const login = useLogin();
  const biometricLogin = useBiometricLogin();
  const { offerEnrollment } = useBiometricEnrollment();
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const capability = useBiometricCapability();
  const [serverError, setServerError] = useState<string | null>(null);

  // Nhãn theo loại sinh trắc máy hỗ trợ (AC11). "Face ID" là mặc định an toàn.
  const bioLabel = capability ? biometricLabel(capability.types) : 'Face ID';
  const bioButtonLabel = `Đăng nhập bằng ${bioLabel}`;
  // Chỉ hiện nút Face ID khi ĐÃ bật + máy còn hỗ trợ sinh trắc (AC1/AC9).
  const showBiometric = biometricEnabled && capability?.isAvailable === true;
  // TODO(story sau): lưu lựa chọn "Ghi nhớ tôi" khi backend/app hỗ trợ.
  const [remember, setRemember] = useState(true);
  const [shake] = useState(() => new Animated.Value(0));
  const passwordState = useRef({ focused: false, hidden: true });

  const { control, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const updatePassword = (patch: Partial<{ focused: boolean; hidden: boolean }>) => {
    passwordState.current = { ...passwordState.current, ...patch };
    const { focused, hidden } = passwordState.current;
    onCoverEyesChange?.(focused && hidden);
  };

  const shakeCard = () => {
    shake.setValue(0);
    Animated.sequence(
      [-10, 9, -6, 4, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 70, useNativeDriver: true }),
      ),
    ).start();
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login.mutateAsync(values);
      // AC2/AC3: mời bật Face ID sau khi login mật khẩu thành công (nếu máy hỗ trợ
      // và chưa bật). Người dùng Để sau/huỷ vẫn vào app bình thường.
      await offerEnrollment();
      onSuccess?.();
    } catch (error) {
      // Ưu tiên message backend trả (vd "Email hoặc mật khẩu không đúng" / "Tài khoản đã bị khoá").
      const message =
        error instanceof ApiError ? error.message : 'Có lỗi xảy ra, thử lại sau';
      setServerError(message);
      shakeCard();
      onLoginFailed?.();
    }
  });

  /** Mở lại app bằng Face ID (AC4/AC5/AC6). */
  const onBiometricPress = async () => {
    setServerError(null);
    const outcome = await biometricLogin.mutateAsync(bioButtonLabel);
    if (outcome.kind === 'success') {
      onSuccess?.();
      return;
    }
    if (outcome.kind === 'expired') {
      // AC6: refresh token đã bị thu hồi → ở màn Đăng nhập, báo đăng nhập lại bằng mật khẩu.
      setServerError(SESSION_EXPIRED_MESSAGE);
      shakeCard();
      onLoginFailed?.();
    }
    // 'cancelled' (AC5): ở lại màn Đăng nhập, không lộ lỗi hệ thống, cho gõ mật khẩu.
  };

  return (
    <View style={styles.form}>
      <Animated.View style={[styles.card, { transform: [{ translateX: shake }] }]}>
        {serverError ? (
          <View style={styles.serverError}>
            <AlertIcon color={brand.errorText} />
            <Text accessibilityRole="alert" style={styles.serverErrorText}>
              {serverError}
            </Text>
          </View>
        ) : null}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField
              label="Email"
              icon="mail"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="ban@congty.vn"
              error={formState.errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <FormField
              label="Mật khẩu"
              icon="lock"
              value={value}
              onChangeText={onChange}
              onFocus={() => updatePassword({ focused: true })}
              onBlur={() => {
                onBlur();
                updatePassword({ focused: false });
              }}
              onSecureVisibilityChange={(hidden) => updatePassword({ hidden })}
              secureToggle
              autoCapitalize="none"
              textContentType="password"
              placeholder="Mật khẩu"
              error={formState.errors.password?.message}
            />
          )}
        />

        <View style={styles.row}>
          <View style={styles.remember}>
            <Switch
              accessibilityLabel="Ghi nhớ tôi"
              value={remember}
              onValueChange={setRemember}
              trackColor={{ true: brand.accentSoft, false: '#C9D6CD' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#C9D6CD"
            />
            <Text style={styles.rememberText}>Ghi nhớ tôi</Text>
          </View>
          <Pressable
            accessibilityRole="link"
            onPress={() => comingSoon('Quên mật khẩu')}
            hitSlop={8}
            style={styles.linkHit}
          >
            <Text style={styles.link}>Quên mật khẩu?</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đăng nhập"
          accessibilityState={{ disabled: login.isPending, busy: login.isPending }}
          disabled={login.isPending}
          onPress={onSubmit}
          style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}
        >
          {login.isPending ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.submitText}>Đang xác thực…</Text>
            </>
          ) : (
            <>
              <Text style={styles.submitText}>Đăng nhập</Text>
              <ArrowRightIcon color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </Animated.View>

      {showBiometric ? (
        <>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>hoặc</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={bioButtonLabel}
            accessibilityState={{
              disabled: biometricLogin.isPending,
              busy: biometricLogin.isPending,
            }}
            disabled={biometricLogin.isPending}
            onPress={onBiometricPress}
            style={({ pressed }) => [styles.faceId, pressed && styles.faceIdPressed]}
          >
            {biometricLogin.isPending ? (
              <ActivityIndicator color={brand.ink} />
            ) : (
              <>
                <FaceIdIcon color={brand.ink} />
                <Text style={styles.faceIdText}>{bioButtonLabel}</Text>
              </>
            )}
          </Pressable>
        </>
      ) : null}

      <Text style={styles.footer}>
        Chưa có tài khoản? <Text style={styles.footerStrong}>Liên hệ quản trị viên</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  card: {
    gap: 14,
    padding: 16,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: brand.cardBorder,
    shadowColor: '#17502D',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  serverError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: brand.errorBg,
    borderColor: brand.errorBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  serverErrorText: { flex: 1, color: brand.errorText, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remember: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rememberText: { fontSize: 14, color: '#2C3A31' },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 14, fontWeight: '600', color: brand.accent },
  submit: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: brand.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: brand.accent,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  submitPressed: { backgroundColor: brand.accentPressed, transform: [{ scale: 0.98 }] },
  submitText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: brand.border },
  dividerText: { fontSize: 13, color: brand.sub },
  faceId: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: brand.border,
    backgroundColor: 'rgba(255,255,255,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  faceIdPressed: { transform: [{ scale: 0.98 }] },
  faceIdText: { fontSize: 16, fontWeight: '600', color: brand.ink },
  footer: { textAlign: 'center', fontSize: 15, color: brand.sub, marginTop: 4 },
  footerStrong: { fontWeight: '700', color: brand.accent },
});
