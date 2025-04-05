import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    mode: 'development',
    entry: {
        game: './src/game.ts',
        index: './src/start.ts'
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
    devtool: 'inline-source-map',
    watch: true,
    watchOptions: {
        ignored: /node_modules/,
        aggregateTimeout: 300,
        poll: 1000
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
            "fs": false,
            "path": false,
            "crypto": false,
            "stream": false,
            "buffer": false,
            "util": false,
            "url": false,
            "http": false,
            "https": false,
            "zlib": false,
            "net": false,
            "tls": false,
            "dns": false,
            "dgram": false,
            "child_process": false,
            "os": false,
            "assert": false,
            "querystring": false,
            "punycode": false,
            "string_decoder": false,
            "constants": false,
            "process": false,
            "events": false,
            "timers": false,
            "domain": false,
            "module": false,
            "vm": false,
            "worker_threads": false,
            "perf_hooks": false,
            "async_hooks": false
        }
    }
}; 