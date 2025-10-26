const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isDev = argv.mode !== 'production';

  return {
    mode: isDev ? 'development' : 'production',
    target: 'web',
    entry: './src/renderer/index.tsx',
    devtool: isDev ? 'inline-source-map' : false,
    output: {
      path: path.resolve(__dirname, 'dist/renderer'),
      filename: 'renderer.js',
      clean: true
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      fallback: { path: false, fs: false, os: false, events: false }
    },
    externals: {
      electron: 'commonjs2 electron'
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                // only enable the refresh transformer in dev
                getCustomTransformers: isDev
                  ? { before: [require('react-refresh-typescript')()] }
                  : undefined,
                transpileOnly: isDev
              }
            }
          ],
          exclude: /node_modules/
        },
        { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/[name][contenthash][ext]' }
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({ template: './public/index.html' }),
      // ensure NODE_ENV is baked into the bundle
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production')
      }),
      ...(isDev ? [new ReactRefreshWebpackPlugin({ overlay: false })] : [])
    ],
    devServer: {
      static: [
        { directory: path.join(__dirname, 'dist/renderer') },
        { directory: path.join(__dirname, 'public'), publicPath: '/' }
      ],
      port: 3000,
      hot: true,
      liveReload: false,
      headers: { 'Access-Control-Allow-Origin': '*' },
      allowedHosts: 'all',
      client: { webSocketURL: 'ws://localhost:3000/ws' }
    }
  };
};
