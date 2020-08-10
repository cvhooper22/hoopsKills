const webpack = require('webpack');
const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: 'server.js',
  output: {
    path: path.resolve(__dirname),
    filename: 'serverBundle.js',
    publicPath: '/'
  },
  devtool: 'cheap-module-source-map',
  target: 'node',
  externals: nodeExternals(),
  module: {
    rules: [
      {
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true,
            },
          },
          {
            loader: 'postcss-loader',
            options: {
              sourceMap: 'inline',
            },
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true,
            },
          },
        ],
        test: /\.scss$/,
        include: path.join(__dirname, 'client/stylesheets'),
      },
      {
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
            },
          },
        ],
        test: /\.jsx?$/,
        include: [
          path.join(__dirname, 'client'),
          path.join(__dirname, 'server'),
        ],
      },
    ],
  },
}