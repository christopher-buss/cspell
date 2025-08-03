import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'eslint-rule-benchmark';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = dirname(__dirname);

export default defineConfig({
    iterations: 50,
    warmup: {
        iterations: 10,
    },

    tests: [
        {
            name: 'cspell-spellchecker',
            ruleId: 'spellchecker',
            rulePath: join(packageRoot, 'dist/plugin/cspell-eslint-plugin.cjs'),

            cases: [
                {
                    name: 'small-file',
                    testPath: join(__dirname, 'spellchecker/small-file.js'),
                },
                {
                    name: 'large-file',
                    testPath: join(__dirname, 'spellchecker/large-file.js'),
                    iterations: 20,
                },
                {
                    name: 'complex-typescript',
                    testPath: join(__dirname, 'spellchecker/complex-file.ts'),
                },

                {
                    name: 'string-heavy',
                    testPath: join(__dirname, 'spellchecker/string-heavy.js'),
                },
                {
                    name: 'string-heavy-errors',
                    testPath: join(__dirname, 'spellchecker/string-heavy-errors.js'),
                },
                {
                    name: 'comment-heavy',
                    testPath: join(__dirname, 'spellchecker/comment-heavy.js'),
                },
                {
                    name: 'react-jsx',
                    testPath: join(__dirname, 'spellchecker/react-component.jsx'),
                },
                {
                    name: 'with-autofix',
                    testPath: join(__dirname, 'spellchecker/medium-file-clean.js'),
                    options: [
                        {
                            autoFix: true,
                            numSuggestions: 5,
                        },
                    ],
                },
                {
                    name: 'no-suggestions',
                    testPath: join(__dirname, 'spellchecker/medium-file-clean.js'),
                    options: [
                        {
                            autoFix: false,
                            numSuggestions: 0,
                        },
                    ],
                },
                {
                    name: 'comments-only',
                    testPath: join(__dirname, 'spellchecker/comment-heavy.js'),
                    options: [
                        {
                            checkComments: true,
                            checkStrings: false,
                            checkStringTemplates: false,
                            checkIdentifiers: false,
                            checkJSXText: false,
                        },
                    ],
                },
                {
                    name: 'strings-only',
                    testPath: join(__dirname, 'spellchecker/string-heavy.js'),
                    options: [
                        {
                            checkComments: false,
                            checkStrings: true,
                            checkStringTemplates: true,
                            checkIdentifiers: false,
                            checkJSXText: false,
                        },
                    ],
                },
                {
                    name: 'medium-file-clean',
                    testPath: join(__dirname, 'spellchecker/medium-file-clean.js'),
                },
                {
                    name: 'medium-file-errors',
                    testPath: join(__dirname, 'spellchecker/medium-file-errors.js'),
                },
            ],
        },
    ],
});