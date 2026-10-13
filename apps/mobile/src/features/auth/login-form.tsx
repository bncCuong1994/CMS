import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/Button';
import { FormField } from '@/components/FormField';
import { ApiError } from '@/lib/api-error';
import { useLogin } from './use-login';

const loginSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  /** Gọi khi đăng nhập thành công (điều hướng về Trang chủ). */
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login.mutateAsync(values);
      onSuccess?.();
    } catch (error) {
      // Ưu tiên message backend trả (vd "Email hoặc mật khẩu không đúng" / "Tài khoản đã bị khoá").
      const message =
        error instanceof ApiError ? error.message : 'Có lỗi xảy ra, thử lại sau';
      setServerError(message);
    }
  });

  return (
    <View style={styles.form}>
      {serverError ? (
        <Text accessibilityRole="alert" style={styles.serverError}>
          {serverError}
        </Text>
      ) : null}

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <FormField
            label="Email"
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
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureToggle
            autoCapitalize="none"
            textContentType="password"
            placeholder="Mật khẩu"
            error={formState.errors.password?.message}
          />
        )}
      />

      <Button
        title="Đăng nhập"
        onPress={onSubmit}
        loading={login.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  serverError: {
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
  },
});
