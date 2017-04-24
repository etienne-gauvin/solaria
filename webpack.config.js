module.exports = {
    entry: "./src/js/solaria.js",
    output: {
        filename: "solaria-bundle.js",
        path: __dirname + "/public/build"
    },

    devtool: "source-map",

    resolve: {
        extensions: [".ts", ".js", ".json"]
    },

    module: {
        rules: [
            { test: /\.ts$/, loader: "awesome-typescript-loader" },
            { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
        ]
    },

    externals: {
    },
};