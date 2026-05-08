const { withAppBuildGradle } = require('@expo/config-plugins');

// @react-native-voice/voice depends on the entire com.android.support group (28.0.0),
// which conflicts with AndroidX libraries already in the project. With Jetifier enabled,
// the old Support Library bytecode is rewritten to use AndroidX imports, so the original
// com.android.support JARs can be safely excluded from the classpath entirely.
const withAndroidVoiceFix = (config) => {
  return withAppBuildGradle(config, (gradleConfig) => {
    const contents = gradleConfig.modResults.contents;
    const exclusion = `configurations.all {
    exclude group: "com.android.support"
}

`;
    if (!contents.includes('exclude group: "com.android.support"')) {
      gradleConfig.modResults.contents = exclusion + contents;
    }
    return gradleConfig;
  });
};

module.exports = withAndroidVoiceFix;
