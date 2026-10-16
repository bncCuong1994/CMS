/**
 * Config plugin: làm AppDelegate tương thích vòng đời UIScene (iOS 27).
 *
 * Bối cảnh: Expo SDK 54 (expo core v57) prebuild sinh ra AppDelegate theo mô
 * hình pre-scene — tự gọi `factory.startReactNative(...)` trong
 * `didFinishLaunchingWithOptions`. Nhưng app khai `UIApplicationSceneManifest`
 * dùng scene delegate `EXExpoAppSceneDelegate` (bắt buộc để iOS 27 không assert
 * khi khởi chạy). Scene delegate đó yêu cầu AppDelegate:
 *   1. conform `ExpoReactNativeFactoryProvider`, và
 *   2. CHỈ tạo `reactNativeFactory` trong didFinishLaunching, KHÔNG tự start —
 *      việc start React Native do scene delegate làm khi scene kết nối.
 * Nếu không khớp, app crash: "ExpoAppSceneDelegate couldn't start React Native
 * because the app delegate isn't an ExpoAppDelegate that provides a React
 * Native factory."
 *
 * Plugin này sửa AppDelegate do CNG sinh (idempotent) để khớp hợp đồng trên,
 * thay vì sửa tay file trong ios/ (sẽ bị prebuild ghi đè).
 */
const { withAppDelegate } = require('expo/config-plugins');

const PROVIDER = 'ExpoReactNativeFactoryProvider';

/**
 * Thêm conformance ExpoReactNativeFactoryProvider vào khai báo lớp AppDelegate.
 */
function addProviderConformance(contents) {
  if (contents.includes(PROVIDER)) {
    return contents;
  }
  return contents.replace(
    /class AppDelegate:\s*ExpoAppDelegate\b/,
    `class AppDelegate: ExpoAppDelegate, ${PROVIDER}`
  );
}

/**
 * Bỏ khối tự start React Native trong didFinishLaunching. Dưới vòng đời scene,
 * cửa sổ và việc start do scene delegate đảm nhiệm; AppDelegate chỉ giữ factory.
 */
function removeManualStart(contents) {
  const startBlock =
    /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\(\s*\n\s*withModuleName: "main",\s*\n\s*in: window,\s*\n\s*launchOptions: launchOptions\)\s*\n#endif\s*\n/;
  if (!startBlock.test(contents)) {
    return contents;
  }
  return contents.replace(
    startBlock,
    '    // Dưới vòng đời UIScene, EXExpoAppSceneDelegate tạo cửa sổ và start\n' +
      '    // React Native khi scene kết nối. AppDelegate chỉ giữ factory.\n'
  );
}

module.exports = function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error(
        'withSceneAppDelegate chỉ hỗ trợ AppDelegate Swift (Expo SDK hiện tại).'
      );
    }
    let contents = cfg.modResults.contents;
    contents = addProviderConformance(contents);
    contents = removeManualStart(contents);
    cfg.modResults.contents = contents;
    return cfg;
  });
};
