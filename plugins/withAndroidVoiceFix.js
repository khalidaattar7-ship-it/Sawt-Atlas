const { withAppBuildGradle } = require('@expo/config-plugins');

// @react-native-voice/voice pulls in com.android.support:versionedparcelable:28.0.0
// which conflicts with androidx.versionedparcelable:1.1.1 (AndroidX) used by the rest of the app.
// This exclusion rule drops the old Support Library version from all Gradle configurations.
const withAndroidVoiceFix = (config) => {
  return withAppBuildGradle(config, (gradleConfig) => {
    const contents = gradleConfig.modResults.contents;
    const exclusion = `configurations.all {
    exclude group: "com.android.support", module: "versionedparcelable"
}

`;
    if (!contents.includes('exclude group: "com.android.support", module: "versionedparcelable"')) {
      gradleConfig.modResults.contents = exclusion + contents;
    }
    return gradleConfig;
  });
};

module.exports = withAndroidVoiceFix;
