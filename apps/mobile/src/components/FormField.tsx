import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { brand } from '@/lib/brand';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from './icons';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** Hiện nút ẩn/hiện cho ô mật khẩu. */
  secureToggle?: boolean;
  /** Icon trang trí bên trái ô nhập. */
  icon?: 'mail' | 'lock';
  /** Báo ra ngoài mỗi khi người dùng bấm ẩn/hiện mật khẩu (true = đang ẩn). */
  onSecureVisibilityChange?: (hidden: boolean) => void;
}

/** Ô nhập có label (cho trợ năng) + thông báo lỗi; viền sáng màu thương hiệu khi đang nhập. */
export function FormField({
  label,
  error,
  secureToggle = false,
  icon,
  onSecureVisibilityChange,
  onFocus,
  onBlur,
  ...inputProps
}: FormFieldProps) {
  const [hidden, setHidden] = useState(secureToggle);
  const [focused, setFocused] = useState(false);

  const iconColor = focused ? brand.accent : brand.muted;
  const borderColor = error ? brand.error : focused ? brand.accent : brand.border;

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    onSecureVisibilityChange?.(next);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {/*
        Viền sáng khi focus đổi QUA borderColor; bóng đổ (styles.boxShadow) để TĨNH,
        luôn hiển thị. Lý do: trên iOS (RN 0.86/Fabric), nếu bật/tắt shadow + elevation
        trên View BỌC TRỰC TIẾP TextInput ngay trong commit của sự kiện onFocus thì native
        view bị dựng lại lớp (layer) → TextInput bị resign first responder → bàn phím rớt
        ngay khi vừa chạm. Đổi mỗi borderColor thì không gây rớt focus (đã kiểm chứng trên
        simulator bằng autoFocus + log FOCUS/BLUR).
      */}
      <View testID={`field-box-${label}`} style={[styles.box, styles.boxShadow, { borderColor }]}>
        {icon ? (
          <View style={styles.icon} pointerEvents="none">
            {icon === 'mail' ? <MailIcon color={iconColor} /> : <LockIcon color={iconColor} />}
          </View>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, icon ? styles.inputWithIcon : null, secureToggle ? styles.inputWithToggle : null]}
          placeholderTextColor="#94a3b8"
          secureTextEntry={secureToggle ? hidden : inputProps.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...inputProps}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
            onPress={toggleHidden}
            style={styles.toggle}
            hitSlop={8}
          >
            {hidden ? <EyeIcon color={brand.sub} /> : <EyeOffIcon color={brand.sub} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#2C3A31' },
  box: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: 16,
    backgroundColor: brand.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Bóng đổ TĨNH (không bật/tắt theo focus) — xem chú thích ở chỗ dùng.
  boxShadow: {
    shadowColor: brand.accent,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  icon: { position: 'absolute', left: 16 },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: brand.ink,
  },
  inputWithIcon: { paddingLeft: 48 },
  inputWithToggle: { paddingRight: 52 },
  toggle: {
    position: 'absolute',
    right: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: brand.error, fontSize: 13 },
});
