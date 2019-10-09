import typescriptPlugin from "rollup-plugin-typescript2";
import { terser } from "rollup-plugin-terser"
 import pkg from "./package.json";

export default {
    input: "src/index.ts",
    output: [
        {
            file: pkg.main,
            format: "umd",
            name: "shotify",
            globals: {
                html2canvas: "html2canvas"
            }
        },
        {
            file: 'lib/index.min.js',
            format: "umd",
            name: "shotify",
            globals: {
                html2canvas: "html2canvas"
            }
        },
        {
            file: pkg.module,
            format: "esm"
        }
    ],
    external: [...Object.keys(pkg.dependencies || {})],
    plugins: [
        terser({
            include: [/^.+\.min\.js$/],
            exclude: ['some*']
        }),
        typescriptPlugin({
            typescript: require("typescript")
        })
    ]
};
