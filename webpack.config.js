const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  target: 'web',
  entry: './src/renderer/index.tsx',
  devtool: 'inline-source-map',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    fallback: {
      "path": false,
      "fs": false,
      "os": false,
      "events": false
    }
  },
  externals: {
    'electron': 'commonjs2 electron'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              getCustomTransformers: () => ({
                before: [require('react-refresh-typescript')()]
              }),
              transpileOnly: true
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html'
    }),
    new ReactRefreshWebpackPlugin({
      overlay: false
    })
  ],
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'dist/renderer')
      },
      {
        directory: path.join(__dirname, 'public'),
        publicPath: '/'
      }
    ],
    port: 3000,
    hot: true,
    liveReload: false,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    allowedHosts: 'all',
    client: {
      webSocketURL: 'ws://localhost:3000/ws'
    }
  }
};
