// Configuration pour Metro avec polyfills Node.js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Chemin vers notre module vide
const emptyModule = path.resolve(__dirname, 'empty-module.js');

// Fournir les polyfills pour les modules Node.js
config.resolver.extraNodeModules = {
  // Polyfills réels
  stream: require.resolve('stream-browserify'),
  crypto: require.resolve('crypto-browserify'),
  url: require.resolve('url'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  events: require.resolve('events'),
  
  // Modules vides pour les API Node.js non utilisées mais importées par des dépendances
  net: emptyModule,
  tls: emptyModule,
  fs: emptyModule,
  dgram: emptyModule,
  path: emptyModule,
  zlib: emptyModule
};

module.exports = config; 