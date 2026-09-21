module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./"
          }
        }
      ],
      "react-native-worklets-core/plugin",
      "react-native-reanimated/plugin"
    ]
  };
};