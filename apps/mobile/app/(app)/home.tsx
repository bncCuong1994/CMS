import type { RoleCode } from '@cms/shared-types';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { brand } from '@/lib/brand';
import { useAuthStore } from '@/features/auth/auth-store';
import { useLogout } from '@/features/auth/use-logout';
import { useMe } from '@/features/auth/use-me';

const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Quản trị viên',
  USER: 'Nhân viên',
  INTERN: 'Thực tập sinh',
};

function roleLabel(role: RoleCode): string {
  return ROLE_LABELS[role] ?? role;
}

export default function HomeScreen() {
  // user trong store đã có từ lúc đăng nhập (login trả MeResponse đầy đủ);
  // useMe làm tươi lại khi mở app / màn này.
  const user = useAuthStore((s) => s.user);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const disableBiometric = useAuthStore((s) => s.disableBiometric);
  const me = useMe();
  const logout = useLogout();

  // AC8: đường tắt tối thiểu để TẮT Face ID (màn Cài đặt đầy đủ để story sau).
  // Chỉ cho tắt ở đây; bật diễn ra qua lời mời sau khi đăng nhập mật khẩu (AC2/AC3).
  const handleToggleBiometric = (next: boolean) => {
    if (!next) void disableBiometric();
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => router.replace('/(auth)/login'),
    });
  };

  const profile = me.data ?? user;
  const roleNames = profile?.roles.map((r) => roleLabel(r.role)).join(', ') ?? '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Xin chào</Text>
          {profile ? (
            <>
              <Text style={styles.name}>{profile.fullName}</Text>
              {roleNames ? <Text style={styles.role}>{roleNames}</Text> : null}
            </>
          ) : (
            <ActivityIndicator color="#2563eb" />
          )}
        </View>

        {/* Chỗ dành cho nút Chấm công của US-ATT-04 — CHƯA làm trong story này. */}
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Tính năng chấm công sẽ có ở bản cập nhật sau.</Text>
        </View>

        {biometricEnabled ? (
          <View style={styles.settingRow}>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Đăng nhập bằng Face ID</Text>
              <Text style={styles.settingHint}>Tắt để mở app chỉ bằng email và mật khẩu.</Text>
            </View>
            <Switch
              accessibilityLabel="Đăng nhập bằng Face ID"
              accessibilityRole="switch"
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{ true: brand.accentSoft, false: '#C9D6CD' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#C9D6CD"
            />
          </View>
        ) : null}

        <View style={styles.footer}>
          <Button
            title="Đăng xuất"
            variant="secondary"
            onPress={handleLogout}
            loading={logout.isPending}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, padding: 24, gap: 24 },
  header: { gap: 4, marginTop: 16 },
  greeting: { fontSize: 15, color: '#64748b' },
  name: { fontSize: 26, fontWeight: '700', color: '#0f172a' },
  role: { fontSize: 15, color: '#2563eb', fontWeight: '600' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
  },
  placeholderText: { color: '#94a3b8', textAlign: 'center', fontSize: 15 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
  },
  settingText: { flex: 1, gap: 2 },
  settingTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  settingHint: { fontSize: 13, color: '#64748b' },
  footer: { paddingBottom: 8 },
});
