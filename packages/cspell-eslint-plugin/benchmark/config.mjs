import { defineConfig } from 'eslint-rule-benchmark';

export default defineConfig({
    iterations: 50,
    warmup: {
        iterations: 10,
    },

    tests: [
        {
            name: 'Rule: spellchecker',
            ruleId: 'spellchecker',
            rulePath: './dist/plugin/index.cjs',

            cases: [
                {
                    testPath: './benchmark/spellchecker/small-file.js',
                },

                // Typical use case
                {
                    testPath: './benchmark/spellchecker/medium-file.js',
                },

                // Stress test with large file
                {
                    testPath: './benchmark/spellchecker/large-file.js',
                },

                // TypeScript with complex AST
                {
                    testPath: './benchmark/spellchecker/complex-file.ts',
                },

                // Many string literals
                {
                    testPath: './benchmark/spellchecker/string-heavy.js',
                },

                // Many comments
                {
                    testPath: './benchmark/spellchecker/comment-heavy.js',
                },

                // React JSX component
                {
                    testPath: './benchmark/spellchecker/react-component.jsx',
                },

                // With autoFix enabled
                {
                    testPath: './benchmark/spellchecker/medium-file.js',
                    options: [
                        {
                            autoFix: true,
                            numSuggestions: 5,
                        },
                    ],
                },

                // With no suggestions (fastest mode)
                {
                    testPath: './benchmark/spellchecker/medium-file.js',
                    options: [
                        {
                            autoFix: false,
                            numSuggestions: 0,
                        },
                    ],
                },

                // Only check comments
                {
                    testPath: './benchmark/spellchecker/comment-heavy.js',
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

                // Only check strings
                {
                    testPath: './benchmark/spellchecker/string-heavy.js',
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
            ],
        },
    ],
});