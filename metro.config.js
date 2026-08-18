/* global __dirname */
/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /.*\/expo\/.*/,
  /.*\\expo\\.*/,
  /.*\/server\/.*/,
  /.*\\server\\.*/,
];

module.exports = config;