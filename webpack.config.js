const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/game.ts',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/dist/'
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    devServer: {
        static: {
            directory: __dirname
        },
        devMiddleware: {
             publicPath: '/dist/' 
        },
        liveReload: true,
        port: 8080,
        proxy: [
            {
                context: ['/colyseus', '/matchmake'],
                target: 'http://localhost:3000',
                ws: true
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "fs": false,
            "net": false,
            "tls": false,
            "crypto": false,
            "stream": false,
            "path": false,
            "os": false,
            "http": false,
            "https": false,
            "zlib": false,
            "url": false,
            "buffer": false,
            "util": false,
            "assert": false,
            "querystring": false,
            "punycode": false,
            "process": false,
            "dns": false,
            "dgram": false,
            "child_process": false,
            "module": false,
            "worker_threads": false,
            "perf_hooks": false,
            "async_hooks": false,
            "diagnostics_channel": false,
            "events": false,
            "string_decoder": false,
            "timers": false,
            "v8": false,
            "vm": false,
            "wasi": false,
            "inspector": false,
            "test": false,
            "readline": false,
            "repl": false,
            "trace_events": false,
            "tty": false,
            "domain": false,
            "constants": false,
            "os-browserify": false,
            "@pm2/io": false
        }
    },
}; 