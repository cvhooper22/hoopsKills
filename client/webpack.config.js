const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: './src/index.js',

  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'index.js',
  },
  devtool: 'source-map',

  devServer: {
    inline: true,
    port: 8888,
    historyApiFallback: true,
  },

  mode: 'development',

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
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'styles.css',
      chunkFileName: '[id].css',
    }),
  ],
};
