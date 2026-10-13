import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** Hiện nút ẩn/hiện cho ô mật khẩu. */
  secureToggle?: boolean;
}

/** Ô nhập có label (cho trợ năng) + thông báo lỗi; hỗ trợ ẩn/hiện mật khẩu. */
export function FormField({
  label,
  error,
  secureToggle = false,
  ...inputProps
}: FormFieldProps) {
  const [hidden, setHidden] = useState(secureToggle);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, error ? styles.inputError : null]}
          placeholderTextColor="#94a3b8"
          secureTextEntry={secureToggle ? hidden : inputProps.secureTextEntry}
          {...inputProps}
        />
        {secureToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
            onPress={() => setHidden((v) => !v)}
            style={styles.toggle}
            hitSlop={8}
          >
            <Text style={styles.toggleText}>{hidden ? 'Hiện' : 'Ẩn'}</Text>
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
  label: { fontSize: 14, fontWeight: '600', color: '#334155' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  inputError: { borderColor: '#dc2626' },
  toggle: { position: 'absolute', right: 12, padding: 4 },
  toggleText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  errorText: { color: '#dc2626', fontSize: 13 },
});
