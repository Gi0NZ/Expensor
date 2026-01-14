const path = require("path");

module.exports = {
    entry: "./src/index.js", // File di ingresso dell'app
    output: {
        path: path.resolve(__dirname, "dist"), // Directory di output
        filename: "bundle.js", // Nome del file compilato
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader", // Usa Babel per la compatibilità
                },
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"], // Gestisce i file CSS
            },
        ],
    },
    resolve: {
        extensions: [".js", ".jsx"], // Permette l'import senza estensione
    },
    devServer: {
        static: path.join(__dirname, "public"), // Serve i file statici
        compress: true,
        port: 3000, // Porta del server di sviluppo
        historyApiFallback: true, // Permette di usare React Router senza problemi
    },
    mode: "development", // Può essere "development" o "production"
};
