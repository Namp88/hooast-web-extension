const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const mode = argv?.mode || 'production';
  const isDev = mode === 'development';

  return {
    mode,
    entry: {
      background: './src/background/background.ts',
      'content-script': './src/content-script/content-script.ts',
      'injected-provider': './src/content-script/injected-provider.ts', // ← ADD THIS
      popup: './src/popup/popup.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      fallback: {
        buffer: require.resolve('buffer/'),
        crypto: false,
        stream: false,
        path: false,
        fs: false,
      },
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'src/manifest.json', to: 'manifest.json' },
          { from: 'src/popup/popup.html', to: 'popup.html' },
          { from: 'src/popup/design-tokens.css', to: 'design-tokens.css' },
          { from: 'src/popup/popup.css', to: 'popup.css' },
          { from: 'src/popup/hero-common.css', to: 'hero-common.css' },
          { from: 'src/popup/unlock-hero.css', to: 'unlock-hero.css' },
          { from: 'src/popup/wallet-hero.css', to: 'wallet-hero.css' },
          { from: 'src/popup/welcome-hero.css', to: 'welcome-hero.css' },
          { from: 'src/popup/create-import-hero.css', to: 'create-import-hero.css' },
          { from: 'src/popup/receive-hero.css', to: 'receive-hero.css' },
          { from: 'src/popup/settings-hero.css', to: 'settings-hero.css' },
          { from: 'src/icons', to: 'icons' },
          { from: '_locales', to: '_locales' },
        ],
      }),
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
    ],
    devtool: isDev ? 'cheap-module-source-map' : false,
    optimization: {
      minimize: !isDev,
    },
    performance: isDev
      ? false
      : {
          maxAssetSize: 1024 * 1024,
          maxEntrypointSize: 1024 * 1024,
        },
  };
};
