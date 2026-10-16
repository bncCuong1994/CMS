import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Cấu hình Expo. KHÔNG hard-code URL API: đọc từ EXPO_PUBLIC_API_URL
 * (biến môi trường Expo, nạp từ .env). Khi chạy máy thật cần IP LAN của
 * máy chạy apps/api, không dùng localhost.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CMS Chấm công',
  slug: 'cms-mobile',
  scheme: 'cmsmobile',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.cms.mobile',
    // iOS 26+ bắt buộc vòng đời UIScene; khai báo tối thiểu để app khởi chạy được.
    infoPlist: {
      // Bắt buộc cho expo-local-authentication (Face ID đăng nhập lại — US-ATT-08).
      NSFaceIDUsageDescription: 'Dùng Face ID để mở lại app mà không cần gõ mật khẩu.',
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            {
              UISceneConfigurationName: 'Default Configuration',
              UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
            },
          ],
        },
      },
    },
  },
  android: {
    package: 'com.cms.mobile',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-local-authentication',
      { faceIDPermission: 'Dùng Face ID để mở lại app mà không cần gõ mật khẩu.' },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
