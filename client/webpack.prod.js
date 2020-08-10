const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',

  output: {
    path: path.resolve(__dirname, 'production'),
    filename: 'index.js',
  },

  mode: 'production',

  module: {
    rules: [
      {
        test: /.jsx?$/,
        include: [
          path.resolve(__dirname, 'src'),
        ],
        exclude: [
          path.resolve(__dirname, 'node_modules'),
        ],
        use: [{
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/env', {
                  targets: {
                    browsers: ['Chrome >= 59'],
                  },
                },
              ],
              '@babel/react',
            ],
            plugins: [
              '@babel/plugin-proposal-class-properties',
            ],
          },
        }],
      },
      {
        test: /\.s?css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader',
        ],
      },
    ],
  },
  optimization: {
    minimize: true,
    occurrenceOrder: true,
    nodeEnv: 'production',
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'styles.css',
      chunkFileName: '[id].css',
    }),
    new HtmlWebpackPlugin({
      title: 'WebClient.React.Boilerplate - prod',
      template: 'index.ejs',
      filename: 'index.html',
      hash: true,
      inject: false,
      minify: true,
      files: {
        css: [
          { file: '/ivanti.main.css', hash: true },
          { file: '/styles.css', hash: true },
        ],
        js: [
          { file: '/index.js', hash: true },
        ],
      },
    }),
  ],
};
