const path = require('path');

module.exports = {
    mode: 'development',
    entry: './game.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/'
    },
    devServer: {
        static: {
            directory: path.join(__dirname),
        },
        compress: true,
        port: 8080,
        hot: true,
        proxy: [
            {
                context: ['/colyseus', '/matchmake'],
                target: 'http://localhost:3000',
                ws: true
            }
        ]
    },
    resolve: {
        extensions: ['.js'],
    },
}; 