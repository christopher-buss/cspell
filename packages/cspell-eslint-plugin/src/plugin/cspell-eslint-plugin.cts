// cspell:ignore TSESTree

import type { ESLint, Rule } from 'eslint';
import type { Program, Comment, Literal, TemplateElement, Identifier, ExportSpecifier, ImportSpecifier, Node } from 'estree';

import { getDefaultLogger } from '../common/logger.cjs';
import type { Options } from '../common/options.cjs';
import { optionsSchema as schema } from '../generated/schema.cjs';
import type { Issue } from '../spellCheckAST/index.cjs';
import { spellCheckAST } from '../spellCheckAST/index.cjs';
import { createSyncFn } from 'synckit';
import type { SpellCheckFn } from '../spellCheckAST/spellCheck.mjs' with { 'resolution-mode': 'import' };
import type { Key } from '../spellCheckAST/ASTPath.js' with { 'resolution-mode': 'import' };
import type { ASTNode } from '../spellCheckAST/ASTNode.js' with { 'resolution-mode': 'import' };
import { scopeItem } from '../spellCheckAST/scope.cjs';
import { normalizeOptions } from './defaultCheckOptions.cjs';

// Type definitions for non-standard ESTree node types
interface JSXText {
    type: 'JSXText';
    value: string;
    raw: string;
    range?: readonly [number, number];
    loc?: any;
}

interface JSONLiteral {
    type: 'JSONLiteral';
    value: string | number | boolean | null;
    raw: string;
    range?: readonly [number, number];
    loc?: any;
}

// Union type for all possible node types we handle
type ExtendedNode = Node | Comment | JSXText | JSONLiteral;

// Type-safe rule listener interface
interface ExtendedRuleListener extends Rule.RuleListener {
    JSXText?: (node: JSXText) => void;
    JSONLiteral?: (node: JSONLiteral) => void;
}

type ESlintPlugin = ESLint.Plugin;

interface ExtendedSuggestion {
    /**
     * The suggestion.
     */
    word: string;
    /**
     * The word is preferred above others, except other "preferred" words.
     */
    isPreferred?: boolean;
    /**
     * The suggested word adjusted to match the original case.
     */
    wordAdjustedToMatchCase?: string;
}

const messages = {
    wordUnknown: 'Unknown word: "{{word}}"',
    wordForbidden: 'Forbidden word: "{{word}}"',
    suggestWord: '{{word}}{{preferred}}',
} as const;

type Messages = typeof messages;
type MessageIds = keyof Messages;

const ruleMeta: Rule.RuleModule['meta'] = {
    docs: {
        description: 'CSpell spellchecker',
        category: 'Possible Errors',
        recommended: false,
    },
    messages,
    hasSuggestions: true,
    fixable: 'code',
    schema: [schema],
};

let isDebugMode = false;

function nullFix(): null {
    // eslint-disable-next-line unicorn/no-null
    return null;
}

function create(context: Rule.RuleContext): Rule.RuleListener {
    const logger = getDefaultLogger();
    const log = logger.log;
    const options = normalizeOptions(context.options[0] as Options, context.cwd || context.getCwd());
    const autoFix = options.autoFix;
    isDebugMode = options.debugMode ?? isDebugMode;
    logger.enabled = options.debugMode ?? (logger.enabled || isDebugMode);
    logContext(log, context);

    // Shared state moved from spellCheckAST
    const toIgnore = new Set<string>();
    const importedIdentifiers = new Set<string>();
    const toBeChecked: { range: readonly [number, number]; node: ASTNode }[] = [];
    const processedComments = new Set<Comment>(); // Track processed comments to avoid duplicates
    
    // Parent tracking for proper AST navigation
    const parentMap = new WeakMap<Node, Node>();
    
    // Error tracking and categorization for parent relationships
    enum ParentTrackingErrorType {
        INVALID_NODE = 'INVALID_NODE',
        ANCESTOR_API_FAILED = 'ANCESTOR_API_FAILED',
        VISITOR_TRAVERSAL_ERROR = 'VISITOR_TRAVERSAL_ERROR',
        MISSING_CRITICAL_PARENT = 'MISSING_CRITICAL_PARENT',
        CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
        NODE_TYPE_UNKNOWN = 'NODE_TYPE_UNKNOWN'
    }
    
    interface ParentTrackingError {
        type: ParentTrackingErrorType;
        node: Node | null;
        nodeType: string;
        message: string;
        context?: any;
    }
    
    // Track critical node types that require parent relationships for correct processing
    const CRITICAL_NODE_TYPES = new Set([
        'ImportSpecifier',
        'ImportDefaultSpecifier', 
        'ImportNamespaceSpecifier',
        'ExportSpecifier',
        'ExportDefaultDeclaration',
        'ExportNamedDeclaration',
        'Identifier' // Critical for import/export detection
    ]);
    
    // Statistics and error tracking
    const parentTrackingStats = {
        successCount: 0,
        fallbackCount: 0,
        errorCount: 0,
        criticalErrorCount: 0,
        warnings: [] as ParentTrackingError[]
    };

    // Helper functions for error handling and validation
    function logParentTrackingError(error: ParentTrackingError): void {
        parentTrackingStats.errorCount++;
        if (CRITICAL_NODE_TYPES.has(error.nodeType)) {
            parentTrackingStats.criticalErrorCount++;
        }
        parentTrackingStats.warnings.push(error);
        
        if (isDebugMode) {
            log('Parent tracking error [%s]: %s (nodeType: %s)', error.type, error.message, error.nodeType);
            if (error.context) {
                log('Error context: %o', error.context);
            }
        }
    }
    
    function validateNode(node: any, operation: string): boolean {
        if (!node) {
            logParentTrackingError({
                type: ParentTrackingErrorType.INVALID_NODE,
                node: null,
                nodeType: 'null',
                message: `Null node provided to ${operation}`,
                context: { operation }
            });
            return false;
        }
        
        if (typeof node !== 'object') {
            logParentTrackingError({
                type: ParentTrackingErrorType.INVALID_NODE,
                node: null,
                nodeType: typeof node,
                message: `Invalid node type (${typeof node}) provided to ${operation}`,
                context: { operation, nodeValue: node }
            });
            return false;
        }
        
        if (!node.type || typeof node.type !== 'string') {
            logParentTrackingError({
                type: ParentTrackingErrorType.INVALID_NODE,
                node: node,
                nodeType: node.type || 'unknown',
                message: `Node missing or invalid type property in ${operation}`,
                context: { operation, nodeProperties: Object.keys(node) }
            });
            return false;
        }
        
        return true;
    }
    
    function checkForCircularReference(child: Node, parent: Node): boolean {
        // Check if setting this parent would create a circular reference
        let current: Node | undefined = parent;
        let depth = 0;
        const maxDepth = 100; // Prevent infinite loops
        
        while (current && depth < maxDepth) {
            if (current === child) {
                logParentTrackingError({
                    type: ParentTrackingErrorType.CIRCULAR_REFERENCE,
                    node: child,
                    nodeType: child.type,
                    message: `Circular reference detected between ${child.type} and ${parent.type}`,
                    context: { childType: child.type, parentType: parent.type, depth }
                });
                return true;
            }
            current = parentMap.get(current);
            depth++;
        }
        
        if (depth >= maxDepth) {
            logParentTrackingError({
                type: ParentTrackingErrorType.CIRCULAR_REFERENCE,
                node: child,
                nodeType: child.type,
                message: `Potential infinite parent chain detected (depth: ${depth})`,
                context: { childType: child.type, parentType: parent.type, depth }
            });
            return true;
        }
        
        return false;
    }

    // Create spell checker worker
    const spellCheck = createSyncFn<SpellCheckFn>(require.resolve('../spellCheckAST/worker.mjs'));

    // Type guard functions for non-standard nodes
    function isJSXText(node: ExtendedNode): node is JSXText {
        return node.type === 'JSXText';
    }

    function isJSONLiteral(node: ExtendedNode): node is JSONLiteral {
        return node.type === 'JSONLiteral';
    }

    function reportIssue(issue: Issue) {
        const messageId: MessageIds = issue.severity === 'Forbidden' ? 'wordForbidden' : 'wordUnknown';
        const { word, start, end } = issue;
        const data = {
            word,
        };
        const code = contextSourceCode(context);
        const startPos = code.getLocFromIndex(start);
        const endPos = code.getLocFromIndex(end);
        const loc = { start: startPos, end: endPos };

        function fixFactory(word: string): Rule.ReportFixer {
            return (fixer) => fixer.replaceTextRange([start, end], word);
        }

        function createSug(sug: ExtendedSuggestion): Rule.SuggestionReportDescriptor {
            const word = sug.wordAdjustedToMatchCase || sug.word;
            const preferred = sug.isPreferred ? '*' : '';
            const data = { word, preferred };
            const messageId: MessageIds = 'suggestWord';

            return {
                messageId,
                data,
                fix: fixFactory(word),
            };
        }

        // log('Suggestions: %o', issue.suggestions);

        const issueSuggestions = issue.suggestions;
        const fixable = issueSuggestions?.filter((sug) => !!sug.isPreferred);
        const canFix = fixable?.length === 1;
        const preferredSuggestion = autoFix && canFix && fixable[0];
        const fix = preferredSuggestion
            ? fixFactory(preferredSuggestion.wordAdjustedToMatchCase || preferredSuggestion.word)
            : nullFix;
        const suggestions: Rule.ReportDescriptorOptions['suggest'] = issueSuggestions?.map((sug) => createSug(sug));
        const suggest = suggestions;

        const des: Rule.ReportDescriptor = {
            messageId,
            data,
            loc,
            suggest,
            fix,
        };
        context.report(des);
    }

    function createIssueFromSpellCheckResult(spellCheckIssue: any, rangeIdx: number): Issue {
        const { word, start, end, severity } = spellCheckIssue;
        const node = toBeChecked[rangeIdx].node;
        const nodeType = node.type;
        const suggestions = normalizeSuggestions(spellCheckIssue.suggestions, nodeType);
        return { word, start, end, nodeType, node, suggestions, severity };
    }

    function normalizeSuggestions(suggestions: any, nodeType: string): any {
        if (!suggestions) return undefined;

        const needToAdjustSpace = nodeType === 'Identifier';
        if (!needToAdjustSpace) return suggestions;

        const isSpecial = /[^\p{L}_0-9]/u;
        const allSpecial = /[^\p{L}_0-9]/gu;

        return suggestions.map((sug: any) => {
            if (!isSpecial.test(sug.word)) return sug;
            const s = { ...sug };
            s.word = s.word.replaceAll(allSpecial, '_');
            if (s.wordAdjustedToMatchCase) {
                s.wordAdjustedToMatchCase = s.wordAdjustedToMatchCase.replaceAll(allSpecial, '_');
            }
            return s;
        });
    }

    // Helper functions adapted to work with ESLint context
    function getParent(node: Node): Node | undefined {
        // Validate input node
        if (!validateNode(node, 'getParent')) {
            return undefined;
        }
        
        const nodeType = node.type;
        const isCriticalNode = CRITICAL_NODE_TYPES.has(nodeType);
        
        // Primary method: Use our tracked parent map
        const trackedParent = parentMap.get(node);
        if (trackedParent) {
            parentTrackingStats.successCount++;
            
            // Validate the tracked parent
            if (!validateNode(trackedParent, 'getParent.trackedParent')) {
                parentMap.delete(node); // Remove invalid entry
                logParentTrackingError({
                    type: ParentTrackingErrorType.INVALID_NODE,
                    node: node,
                    nodeType: nodeType,
                    message: `Tracked parent is invalid for ${nodeType}`,
                    context: { parentType: trackedParent?.type || 'unknown' }
                });
            } else {
                return trackedParent;
            }
        }
        
        // Fallback method: Use ESLint's sourceCode.getAncestors() if available
        const sourceCode = context.sourceCode || context.getSourceCode();
        if (sourceCode && typeof sourceCode.getAncestors === 'function') {
            try {
                const ancestors = sourceCode.getAncestors(node);
                if (ancestors && Array.isArray(ancestors)) {
                    // getAncestors returns array from root to immediate parent (excluding the node itself)
                    // So the last element is the immediate parent
                    const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined;
                    
                    if (parent) {
                        parentTrackingStats.fallbackCount++;
                        // Cache the discovered parent for future lookups
                        if (validateNode(parent, 'getParent.ancestorFallback')) {
                            parentMap.set(node, parent);
                            return parent;
                        }
                    } else if (isCriticalNode) {
                        logParentTrackingError({
                            type: ParentTrackingErrorType.MISSING_CRITICAL_PARENT,
                            node: node,
                            nodeType: nodeType,
                            message: `No ancestors found for critical node type ${nodeType} using sourceCode.getAncestors`,
                            context: { ancestorsLength: ancestors.length, method: 'sourceCode.getAncestors' }
                        });
                    }
                } else {
                    logParentTrackingError({
                        type: ParentTrackingErrorType.ANCESTOR_API_FAILED,
                        node: node,
                        nodeType: nodeType,
                        message: `sourceCode.getAncestors returned invalid result for ${nodeType}`,
                        context: { ancestorsType: typeof ancestors, ancestorsValue: ancestors }
                    });
                }
            } catch (error) {
                logParentTrackingError({
                    type: ParentTrackingErrorType.ANCESTOR_API_FAILED,
                    node: node,
                    nodeType: nodeType,
                    message: `sourceCode.getAncestors failed for ${nodeType}: ${error}`,
                    context: { error: error instanceof Error ? error.message : String(error), method: 'sourceCode.getAncestors' }
                });
            }
        }
        
        // Final fallback: Legacy context.getAncestors for older ESLint versions
        if ('getAncestors' in context && typeof context.getAncestors === 'function') {
            try {
                const ancestors = (context as any).getAncestors();
                if (ancestors && Array.isArray(ancestors)) {
                    const parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined;
                    
                    if (parent) {
                        parentTrackingStats.fallbackCount++;
                        // Cache the discovered parent for future lookups
                        if (validateNode(parent, 'getParent.legacyFallback')) {
                            parentMap.set(node, parent);
                            return parent;
                        }
                    } else if (isCriticalNode) {
                        logParentTrackingError({
                            type: ParentTrackingErrorType.MISSING_CRITICAL_PARENT,
                            node: node,
                            nodeType: nodeType,
                            message: `No ancestors found for critical node type ${nodeType} using legacy context.getAncestors`,
                            context: { ancestorsLength: ancestors.length, method: 'context.getAncestors' }
                        });
                    }
                } else {
                    logParentTrackingError({
                        type: ParentTrackingErrorType.ANCESTOR_API_FAILED,
                        node: node,
                        nodeType: nodeType,
                        message: `context.getAncestors returned invalid result for ${nodeType}`,
                        context: { ancestorsType: typeof ancestors, ancestorsValue: ancestors }
                    });
                }
            } catch (error) {
                logParentTrackingError({
                    type: ParentTrackingErrorType.ANCESTOR_API_FAILED,
                    node: node,
                    nodeType: nodeType,
                    message: `context.getAncestors failed for ${nodeType}: ${error}`,
                    context: { error: error instanceof Error ? error.message : String(error), method: 'context.getAncestors' }
                });
            }
        }
        
        // Log warning for critical nodes that have no parent
        if (isCriticalNode) {
            logParentTrackingError({
                type: ParentTrackingErrorType.MISSING_CRITICAL_PARENT,
                node: node,
                nodeType: nodeType,
                message: `Unable to establish parent relationship for critical node type ${nodeType}`,
                context: { 
                    hasTrackedParent: parentMap.has(node),
                    hasSourceCodeAPI: !!(sourceCode?.getAncestors),
                    hasLegacyAPI: !!('getAncestors' in context),
                    range: (node as any).range,
                    loc: (node as any).loc
                }
            });
        }
        
        return undefined;
    }
    
    // Populate parent map by traversing AST nodes
    function setParent(parent: Node, child: Node): boolean {
        if (!validateNode(parent, 'setParent.parent') || !validateNode(child, 'setParent.child')) {
            return false;
        }
        
        // Check for circular references
        if (checkForCircularReference(child, parent)) {
            return false;
        }
        
        try {
            parentMap.set(child, parent);
            return true;
        } catch (error) {
            logParentTrackingError({
                type: ParentTrackingErrorType.VISITOR_TRAVERSAL_ERROR,
                node: child,
                nodeType: child.type,
                message: `Failed to set parent relationship: ${error}`,
                context: { 
                    parentType: parent.type,
                    error: error instanceof Error ? error.message : String(error) 
                }
            });
            return false;
        }
    }
    
    // Generic visitor to establish parent-child relationships
    function visitNode(node: Node, parent?: Node): boolean {
        // Enhanced validation with detailed error reporting
        if (!validateNode(node, 'visitNode')) {
            return false;
        }
        
        const nodeType = node.type;
        const isCriticalNode = CRITICAL_NODE_TYPES.has(nodeType);
        
        // Set parent relationship if provided
        if (parent) {
            const success = setParent(parent, node);
            if (!success && isCriticalNode) {
                logParentTrackingError({
                    type: ParentTrackingErrorType.MISSING_CRITICAL_PARENT,
                    node: node,
                    nodeType: nodeType,
                    message: `Failed to establish parent relationship for critical node ${nodeType}`,
                    context: { 
                        parentType: parent.type,
                        operation: 'visitNode.setParent'
                    }
                });
            }
        } else if (isCriticalNode && nodeType !== 'Program') {
            // Program is the root node, so it's okay for it not to have a parent
            logParentTrackingError({
                type: ParentTrackingErrorType.MISSING_CRITICAL_PARENT,
                node: node,
                nodeType: nodeType,
                message: `Critical node ${nodeType} visited without parent`,
                context: { 
                    operation: 'visitNode',
                    range: (node as any).range,
                    loc: (node as any).loc
                }
            });
        }
        
        // Helper function to safely visit a child node
        const visitChild = (child: any, propertyName?: string): boolean => {
            if (!child) return true; // null/undefined children are okay
            
            if (!validateNode(child, `visitNode.${nodeType}.${propertyName || 'child'}`)) {
                return false;
            }
            
            try {
                return visitNode(child, node);
            } catch (error) {
                logParentTrackingError({
                    type: ParentTrackingErrorType.VISITOR_TRAVERSAL_ERROR,
                    node: child,
                    nodeType: child.type || 'unknown',
                    message: `Error visiting child node: ${error}`,
                    context: { 
                        parentType: nodeType,
                        propertyName,
                        error: error instanceof Error ? error.message : String(error)
                    }
                });
                return false;
            }
        };
        
        // Helper function to safely visit an array of child nodes
        const visitChildren = (children: any[], propertyName: string): boolean => {
            if (!children) return true; // null/undefined arrays are okay
            
            if (!Array.isArray(children)) {
                logParentTrackingError({
                    type: ParentTrackingErrorType.VISITOR_TRAVERSAL_ERROR,
                    node: node,
                    nodeType: nodeType,
                    message: `Expected array for ${propertyName}, got ${typeof children}`,
                    context: { 
                        propertyName,
                        actualType: typeof children,
                        actualValue: children
                    }
                });
                return false;
            }
            
            let allSuccessful = true;
            children.forEach((child, index) => {
                if (child !== null && child !== undefined) {
                    const success = visitChild(child, `${propertyName}[${index}]`);
                    if (!success) allSuccessful = false;
                }
            });
            
            return allSuccessful;
        };
        
        // Visit child nodes based on node type
        const nodeAny = node as any;
        let visitSuccess = true;
        
        try {
            switch (nodeType) {
                case 'Program':
                    visitSuccess = visitChildren(nodeAny.body, 'body');
                    break;
                case 'ImportDeclaration':
                    visitSuccess = visitChildren(nodeAny.specifiers, 'specifiers') && 
                                  visitChild(nodeAny.source, 'source');
                    break;
                case 'ImportSpecifier':
                case 'ImportDefaultSpecifier':
                case 'ImportNamespaceSpecifier':
                    visitSuccess = visitChild(nodeAny.imported, 'imported') && 
                                  visitChild(nodeAny.local, 'local');
                    break;
                case 'ExportNamedDeclaration':
                case 'ExportAllDeclaration':
                    visitSuccess = visitChildren(nodeAny.specifiers, 'specifiers') && 
                                  visitChild(nodeAny.source, 'source') && 
                                  visitChild(nodeAny.declaration, 'declaration');
                    break;
                case 'ExportDefaultDeclaration':
                    visitSuccess = visitChild(nodeAny.declaration, 'declaration');
                    break;
                case 'ExportSpecifier':
                    visitSuccess = visitChild(nodeAny.exported, 'exported') && 
                                  visitChild(nodeAny.local, 'local');
                    break;
                case 'MemberExpression':
                    visitSuccess = visitChild(nodeAny.object, 'object') && 
                                  visitChild(nodeAny.property, 'property');
                    break;
                case 'CallExpression':
                case 'NewExpression':
                    visitSuccess = visitChild(nodeAny.callee, 'callee') && 
                                  visitChildren(nodeAny.arguments, 'arguments');
                    break;
                case 'VariableDeclaration':
                    visitSuccess = visitChildren(nodeAny.declarations, 'declarations');
                    break;
                case 'VariableDeclarator':
                    visitSuccess = visitChild(nodeAny.id, 'id') && 
                                  visitChild(nodeAny.init, 'init');
                    break;
                case 'FunctionDeclaration':
                case 'FunctionExpression':
                case 'ArrowFunctionExpression':
                    visitSuccess = visitChild(nodeAny.id, 'id') && 
                                  visitChildren(nodeAny.params, 'params') && 
                                  visitChild(nodeAny.body, 'body');
                    break;
                case 'BlockStatement':
                    visitSuccess = visitChildren(nodeAny.body, 'body');
                    break;
                case 'ExpressionStatement':
                    visitSuccess = visitChild(nodeAny.expression, 'expression');
                    break;
                case 'ReturnStatement':
                case 'ThrowStatement':
                    visitSuccess = visitChild(nodeAny.argument, 'argument');
                    break;
                case 'IfStatement':
                    visitSuccess = visitChild(nodeAny.test, 'test') && 
                                  visitChild(nodeAny.consequent, 'consequent') && 
                                  visitChild(nodeAny.alternate, 'alternate');
                    break;
                case 'WhileStatement':
                case 'DoWhileStatement':
                    visitSuccess = visitChild(nodeAny.test, 'test') && 
                                  visitChild(nodeAny.body, 'body');
                    break;
                case 'ForStatement':
                    visitSuccess = visitChild(nodeAny.init, 'init') && 
                                  visitChild(nodeAny.test, 'test') && 
                                  visitChild(nodeAny.update, 'update') && 
                                  visitChild(nodeAny.body, 'body');
                    break;
                case 'ForInStatement':
                case 'ForOfStatement':
                    visitSuccess = visitChild(nodeAny.left, 'left') && 
                                  visitChild(nodeAny.right, 'right') && 
                                  visitChild(nodeAny.body, 'body');
                    break;
                case 'BinaryExpression':
                case 'LogicalExpression':
                case 'AssignmentExpression':
                    visitSuccess = visitChild(nodeAny.left, 'left') && 
                                  visitChild(nodeAny.right, 'right');
                    break;
                case 'UnaryExpression':
                case 'UpdateExpression':
                    visitSuccess = visitChild(nodeAny.argument, 'argument');
                    break;
                case 'ConditionalExpression':
                    visitSuccess = visitChild(nodeAny.test, 'test') && 
                                  visitChild(nodeAny.consequent, 'consequent') && 
                                  visitChild(nodeAny.alternate, 'alternate');
                    break;
                case 'ArrayExpression':
                    if (nodeAny.elements) {
                        nodeAny.elements.forEach((element: any) => {
                            if (element) visitChild(element); // Handle sparse arrays
                        });
                    }
                    break;
                case 'ObjectExpression':
                    visitSuccess = visitChildren(nodeAny.properties, 'properties');
                    break;
                case 'Property':
                case 'MethodDefinition':
                    visitSuccess = visitChild(nodeAny.key, 'key') && 
                                  visitChild(nodeAny.value, 'value');
                    break;
                case 'TemplateLiteral':
                    visitSuccess = visitChildren(nodeAny.quasis, 'quasis') && 
                                  visitChildren(nodeAny.expressions, 'expressions');
                    break;
                case 'TaggedTemplateExpression':
                    visitSuccess = visitChild(nodeAny.tag, 'tag') && 
                                  visitChild(nodeAny.quasi, 'quasi');
                    break;
                case 'ClassDeclaration':
                case 'ClassExpression':
                    visitSuccess = visitChild(nodeAny.id, 'id') && 
                                  visitChild(nodeAny.superClass, 'superClass') && 
                                  visitChild(nodeAny.body, 'body');
                    break;
                case 'ClassBody':
                    visitSuccess = visitChildren(nodeAny.body, 'body');
                    break;
                case 'TryStatement':
                    visitSuccess = visitChild(nodeAny.block, 'block') && 
                                  visitChild(nodeAny.handler, 'handler') && 
                                  visitChild(nodeAny.finalizer, 'finalizer');
                    break;
                case 'CatchClause':
                    visitSuccess = visitChild(nodeAny.param, 'param') && 
                                  visitChild(nodeAny.body, 'body');
                    break;
                case 'SwitchStatement':
                    visitSuccess = visitChild(nodeAny.discriminant, 'discriminant') && 
                                  visitChildren(nodeAny.cases, 'cases');
                    break;
                case 'SwitchCase':
                    visitSuccess = visitChild(nodeAny.test, 'test') && 
                                  visitChildren(nodeAny.consequent, 'consequent');
                    break;
                case 'LabeledStatement':
                    visitSuccess = visitChild(nodeAny.label, 'label') && 
                                  visitChild(nodeAny.body, 'body');
                    break;
                case 'WithStatement':
                    visitSuccess = visitChild(nodeAny.object, 'object') && 
                                  visitChild(nodeAny.body, 'body');
                    break;
                // JSX nodes (handled as string literals to avoid TypeScript issues)
                default:
                    if ((nodeAny.type as string) === 'JSXElement') {
                        visitSuccess = visitChild(nodeAny.openingElement, 'openingElement') && 
                                      visitChildren(nodeAny.children, 'children') && 
                                      visitChild(nodeAny.closingElement, 'closingElement');
                        break;
                    }
                    if ((nodeAny.type as string) === 'JSXFragment') {
                        visitSuccess = visitChild(nodeAny.openingFragment, 'openingFragment') && 
                                      visitChildren(nodeAny.children, 'children') && 
                                      visitChild(nodeAny.closingFragment, 'closingFragment');
                        break;
                    }
                    if ((nodeAny.type as string) === 'JSXOpeningElement' || (nodeAny.type as string) === 'JSXClosingElement') {
                        visitSuccess = visitChild(nodeAny.name, 'name') && 
                                      visitChildren(nodeAny.attributes, 'attributes');
                        break;
                    }
                    if ((nodeAny.type as string) === 'JSXAttribute') {
                        visitSuccess = visitChild(nodeAny.name, 'name') && 
                                      visitChild(nodeAny.value, 'value');
                        break;
                    }
                    if ((nodeAny.type as string) === 'JSXSpreadAttribute') {
                        visitSuccess = visitChild(nodeAny.argument, 'argument');
                        break;
                    }
                    if ((nodeAny.type as string) === 'JSXExpressionContainer') {
                        visitSuccess = visitChild(nodeAny.expression, 'expression');
                        break;
                    }
                    if ((nodeAny.type as string) === 'JSXMemberExpression') {
                        visitSuccess = visitChild(nodeAny.object, 'object') && 
                                      visitChild(nodeAny.property, 'property');
                        break;
                    }
                    // TypeScript nodes (if supported)
                    if ((nodeAny.type as string) === 'TSTypeAnnotation') {
                        visitSuccess = visitChild(nodeAny.typeAnnotation, 'typeAnnotation');
                        break;
                    }
                    if ((nodeAny.type as string) === 'TSAsExpression' || (nodeAny.type as string) === 'TSTypeAssertion') {
                        visitSuccess = visitChild(nodeAny.expression, 'expression') && 
                                      visitChild(nodeAny.typeAnnotation, 'typeAnnotation');
                        break;
                    }
                    // Leaf nodes (no children to visit)
                    if (['Identifier', 'Literal', 'TemplateElement', 'Super', 'ThisExpression', 
                          'MetaProperty', 'BreakStatement', 'ContinueStatement', 'EmptyStatement', 
                          'DebuggerStatement', 'JSXText', 'JSXIdentifier', 'JSXClosingFragment', 
                          'JSXOpeningFragment'].includes(nodeAny.type as string)) {
                        // These are leaf nodes, no children to visit
                        visitSuccess = true; // Success for leaf nodes
                        break;
                    }
                    
                    // Generic fallback for unknown node types
                    // Log warning for unknown node types
                    logParentTrackingError({
                        type: ParentTrackingErrorType.NODE_TYPE_UNKNOWN,
                        node: node,
                        nodeType: nodeType,
                        message: `Unknown node type ${nodeType}, using generic property traversal`,
                        context: { availableProperties: Object.keys(nodeAny) }
                    });
                    
                    // For unknown node types, try to visit common child properties
                    visitSuccess = visitChildren(nodeAny.body, 'body') &&
                                  visitChildren(nodeAny.declarations, 'declarations') &&
                                  visitChildren(nodeAny.properties, 'properties') &&
                                  visitChildren(nodeAny.elements, 'elements') &&
                                  visitChildren(nodeAny.arguments, 'arguments') &&
                                  visitChildren(nodeAny.params, 'params') &&
                                  visitChildren(nodeAny.specifiers, 'specifiers') &&
                                  visitChildren(nodeAny.attributes, 'attributes') &&
                                  visitChildren(nodeAny.children, 'children') &&
                                  visitChild(nodeAny.source, 'source') &&
                                  visitChild(nodeAny.declaration, 'declaration') &&
                                  visitChild(nodeAny.expression, 'expression') &&
                                  visitChild(nodeAny.object, 'object') &&
                                  visitChild(nodeAny.property, 'property') &&
                                  visitChild(nodeAny.callee, 'callee') &&
                                  visitChild(nodeAny.tag, 'tag') &&
                                  visitChild(nodeAny.quasi, 'quasi');
                    break;
            }
        } catch (error) {
            // Enhanced error handling with detailed logging
            logParentTrackingError({
                type: ParentTrackingErrorType.VISITOR_TRAVERSAL_ERROR,
                node: node,
                nodeType: nodeType,
                message: `Critical error visiting ${nodeType}: ${error}`,
                context: { 
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    parentType: parent?.type,
                    range: (node as any).range,
                    loc: (node as any).loc
                }
            });
            visitSuccess = false;
        }
        
        // Log summary for critical nodes with issues
        if (!visitSuccess && isCriticalNode) {
            logParentTrackingError({
                type: ParentTrackingErrorType.MISSING_CRITICAL_PARENT,
                node: node,
                nodeType: nodeType,
                message: `Failed to properly traverse critical node ${nodeType}`,
                context: { 
                    hasParent: !!parent,
                    parentType: parent?.type,
                    operation: 'visitNode.complete'
                }
            });
        }
        
        return visitSuccess;
    }
    
    // Report parent tracking statistics and warnings
    function reportParentTrackingStats(): void {
        if (isDebugMode && (parentTrackingStats.errorCount > 0 || parentTrackingStats.criticalErrorCount > 0)) {
            log('Parent tracking statistics:');
            log('  Success: %d, Fallback: %d, Errors: %d, Critical errors: %d', 
                parentTrackingStats.successCount,
                parentTrackingStats.fallbackCount, 
                parentTrackingStats.errorCount,
                parentTrackingStats.criticalErrorCount
            );
            
            if (parentTrackingStats.criticalErrorCount > 0) {
                log('Critical parent tracking issues detected:');
                const criticalErrors = parentTrackingStats.warnings.filter(w => 
                    CRITICAL_NODE_TYPES.has(w.nodeType)
                );
                criticalErrors.forEach((error, index) => {
                    log('  %d. %s: %s', index + 1, error.nodeType, error.message);
                });
            }
        }
    }

    function isImportIdentifier(node: Identifier): boolean {
        const parent = getParent(node);
        if (!parent) return false;
        return (
            (parent.type === 'ImportSpecifier' ||
                parent.type === 'ImportNamespaceSpecifier' ||
                parent.type === 'ImportDefaultSpecifier') &&
            (parent as any).local === node
        );
    }

    function isExportIdentifier(node: Identifier): boolean {
        const parent = getExportParent(node);
        if (!parent) return false;
        return parent.type === 'ExportSpecifier' && parent.exported === node;
    }

    function isRawImportIdentifier(node: Identifier): boolean {
        const parent = getParent(node);
        if (!parent) return false;
        return (
            (parent.type === 'ImportSpecifier' && (parent as ImportSpecifier).imported === node) ||
            (parent.type === 'ExportSpecifier' && (parent as ExportSpecifier).local === node)
        );
    }

    function isLocalImportIdentifierUnique(node: Identifier): boolean {
        const parent = getImportParent(node);
        if (!parent) return true;
        const { imported, local } = parent;
        if (imported.type === 'Identifier' && imported.name !== local.name) return true;
        return imported.range?.[0] !== local.range?.[0] && imported.range?.[1] !== local.range?.[1];
    }

    function isLocalExportIdentifierUnique(node: Identifier): boolean {
        const parent = getExportParent(node);
        if (!parent) return true;
        const { exported, local } = parent;
        if (exported.type === 'Identifier' && exported.name !== (local as Identifier).name) return true;
        return exported.range?.[0] !== local.range?.[0] && exported.range?.[1] !== local.range?.[1];
    }

    function getImportParent(node: Identifier): ImportSpecifier | undefined {
        const parent = getParent(node);
        return parent?.type === 'ImportSpecifier' ? parent as ImportSpecifier : undefined;
    }

    function getExportParent(node: Identifier): ExportSpecifier | undefined {
        const parent = getParent(node);
        return parent?.type === 'ExportSpecifier' ? parent as ExportSpecifier : undefined;
    }

    function skipCheckForRawImportIdentifiers(node: Identifier): boolean {
        if (options.ignoreImports) return false;
        const parent = getImportParent(node);
        return !!parent && parent.imported === node && !isLocalImportIdentifierUnique(node);
    }

    function isImportedProperty(node: Identifier): boolean {
        const obj = findOriginObject(node);
        return !!obj && obj.type === 'Identifier' && importedIdentifiers.has(obj.name);
    }

    function isObjectProperty(node: Identifier): boolean {
        const parent = getParent(node);
        return parent?.type === 'MemberExpression';
    }

    function findOriginObject(node: Identifier): Node | undefined {
        const parent = getParent(node);
        if (parent?.type !== 'MemberExpression' || (parent as any).property !== node) return undefined;
        let obj = (parent as any).object;
        while (obj.type === 'MemberExpression') {
            obj = obj.object;
        }
        return obj;
    }

    function isFunctionCall(node: Node | undefined, name: string): boolean {
        if (!node) return false;
        return node.type === 'CallExpression' && (node as any).callee.type === 'Identifier' && (node as any).callee.name === name;
    }

    function isRequireCall(node: Node | undefined) {
        return isFunctionCall(node, 'require');
    }

    function isImportOrRequired(node: Literal): boolean {
        const parent = getParent(node);
        return isRequireCall(parent) || (parent?.type === 'ImportDeclaration' && (parent as any).source === node);
    }

    function isExportNamedDeclaration(node: Literal): boolean {
        const parent = getParent(node);
        return parent?.type === 'ExportNamedDeclaration' && (parent as any).source === node;
    }

    function debugNode(node: ExtendedNode | ASTNode, value: unknown) {
        if (!isDebugMode) return;
        // Create a minimal ASTPath-like object for debugging
        const mockPath = { node: node as ASTNode, key: undefined, prev: undefined };
        log(`${inheritanceSummary(mockPath)}: %o`, value);
        _dumpNode(mockPath);
    }

    function _dumpNode(path: { node: ASTNode; key?: Key; prev?: any }) {
        function value(v: unknown) {
            if (['string', 'number', 'boolean'].includes(typeof v)) return v;
            if (v && typeof v === 'object' && 'type' in v) return `{ type: ${v.type} }`;
            return `<${v}>`;
        }

        function dotValue(v: { [key: string]: unknown } | unknown) {
            if (typeof v === 'object' && v) {
                return Object.fromEntries(Object.entries(v).map(([k, v]) => [k, value(v)]));
            }
            return `<${typeof v}>`;
        }

        const { parent: _, ...n } = path.node;
        const warn = log;
        warn('Node: %o', {
            key: path.key,
            type: n.type,
            path: inheritanceSummary(path),
            node: dotValue(n),
        });
    }

    function inheritanceSummary(path: { node: ASTNode; prev?: any }) {
        // Simplified implementation for ESLint context
        return path.node.type;
    }

    function mapNode(path: { node: ASTNode }, key: Key | undefined) {
        const node = path.node;
        if (node.type === 'Literal') {
            return scopeItem(tagLiteral(node));
        }
        if (node.type === 'Block') {
            const value = typeof node.value === 'string' ? node.value : '';
            return scopeItem(value[0] === '*' ? 'Comment.docBlock' : 'Comment.block');
        }
        if (node.type === 'Line') {
            return scopeItem('Comment.line');
        }
        // Simplified scope mapping for ESLint context
        return scopeItem(node.type);
    }

    function tagLiteral(node: ASTNode): string {
        if (node.type !== 'Literal') return node.type;
        const kind = typeof node.value;
        const extra =
            kind === 'string'
                ? (node as any).raw?.[0] === '"'
                    ? 'string.double'
                    : 'string.single'
                : node.value === null
                  ? 'null'
                  : kind;
        return node.type + '.' + extra;
    }

    function checkNodeText(node: ExtendedNode, _text: string) {
        if (!node.range) return;

        const adj = node.type === 'Literal' ? 1 : 0;
        const range = [node.range[0] + adj, node.range[1] - adj] as const;
        toBeChecked.push({ range, node: node as ASTNode });
    }

    // Main node handlers adapted for ESLint listeners
    function handleLiteral(node: Literal) {
        if (!options.checkStrings) return;
        if (typeof node.value === 'string') {
            debugNode(node, node.value);
            if (options.ignoreImports && (isImportOrRequired(node) || isExportNamedDeclaration(node))) return;
            if (options.ignoreImportProperties && node.type === 'Literal') {
                // For literals, we can't easily check if they're imported properties
                // This would require more complex analysis
            }
            checkNodeText(node, node.value);
        }
    }

    function handleJSXText(node: JSXText) {
        if (!options.checkJSXText) return;
        if (typeof node.value === 'string') {
            debugNode(node, node.value);
            checkNodeText(node, node.value);
        }
    }

    function handleJSONLiteral(node: JSONLiteral) {
        if (!options.checkStrings) return;
        if (typeof node.value === 'string') {
            debugNode(node, node.value);
            if (options.ignoreImports && (isImportOrRequired(node as unknown as Literal) || isExportNamedDeclaration(node as unknown as Literal))) return;
            checkNodeText(node, node.value);
        }
    }

    function handleTemplateElement(node: TemplateElement) {
        if (!options.checkStringTemplates) return;
        debugNode(node, node.value);
        checkNodeText(node, node.value.cooked || node.value.raw);
    }

    function handleIdentifier(node: Identifier) {
        debugNode(node, node.name);
        if (options.ignoreImports) {
            if (isRawImportIdentifier(node)) {
                toIgnore.add(node.name);
                return;
            }
            if (isImportIdentifier(node)) {
                importedIdentifiers.add(node.name);
                if (isLocalImportIdentifierUnique(node)) {
                    checkNodeText(node, node.name);
                }
                return;
            } else if (options.ignoreImportProperties && isImportedProperty(node)) {
                return;
            }
            if (isExportIdentifier(node)) {
                importedIdentifiers.add(node.name);
                if (isLocalExportIdentifierUnique(node)) {
                    checkNodeText(node, node.name);
                }
                return;
            }
        }
        if (!options.checkIdentifiers) return;
        if (toIgnore.has(node.name) && !isObjectProperty(node)) return;
        if (skipCheckForRawImportIdentifiers(node)) return;
        checkNodeText(node, node.name);
    }

    function handleComment(node: Comment) {
        if (!options.checkComments) return;
        if (processedComments.has(node)) return; // Avoid duplicate processing
        processedComments.add(node);
        debugNode(node, node.value);
        checkNodeText(node, node.value);
    }

    /**
     * Process all comments from the source code.
     * This is a robust approach that processes comments directly from the source code
     * rather than relying on fragile listener chaining.
     */
    function processAllComments() {
        if (!options.checkComments) return;
        
        const sourceCode = context.sourceCode || context.getSourceCode();
        if (!sourceCode || !sourceCode.getAllComments) return;

        const comments = sourceCode.getAllComments();
        log('Processing %d comments', comments.length);
        
        for (const comment of comments) {
            handleComment(comment);
        }
    }

    /**
     * Process comments attached to a specific node.
     * This provides an alternative way to process comments as we encounter nodes.
     */
    function processNodeComments(node: Node) {
        if (!options.checkComments) return;

        const sourceCode = context.sourceCode || context.getSourceCode();
        if (!sourceCode || !sourceCode.getCommentsBefore || !sourceCode.getCommentsAfter) return;

        // Process comments before this node
        const commentsBefore = sourceCode.getCommentsBefore(node);
        for (const comment of commentsBefore) {
            handleComment(comment);
        }

        // Process comments after this node
        const commentsAfter = sourceCode.getCommentsAfter(node);
        for (const comment of commentsAfter) {
            handleComment(comment);
        }
    }

    function buildRuleListeners(): ExtendedRuleListener {
        const listeners: ExtendedRuleListener = {};

        // Check if checkScope is being used - if so, fall back to original spellCheckAST
        const hasCheckScope = options.checkScope && options.checkScope.length > 0;
        
        if (hasCheckScope) {
            // Use original spellCheckAST approach when checkScope is configured
            listeners.Program = (node: Program) => {
                // Initialize parent map for the entire AST
                const visitSuccess = visitNode(node);
                if (!visitSuccess) {
                    log('Warning: Parent map initialization had errors for checkScope mode');
                }
                reportParentTrackingStats();
                
                const filename = context.filename || context.getFilename();
                const sc = context.sourceCode || context.getSourceCode();
                if (!sc) return;
                const { issues, errors } = spellCheckAST(filename, sc.text, sc.ast, options);
                if (errors && errors.length) {
                    log(
                        'errors: %o',
                        errors.map((e) => e.message),
                    );
                    errors.forEach((error) => context.report({ message: error.message, loc: { line: 1, column: 1 } }));
                }
                issues.forEach((issue) => reportIssue(issue));
            };
        } else {
            // Use individual listeners approach when checkScope is not configured
            
            // Initialize parent map at the start of processing
            listeners.Program = (node: Program) => {
                const visitSuccess = visitNode(node);
                if (!visitSuccess) {
                    log('Warning: Parent map initialization had errors for individual listeners mode');
                }
            };
            
            // Add conditional listeners based on options
            if (options.checkStrings) {
                listeners.Literal = handleLiteral;
                // Handle JSON literals from jsonc-eslint-parser
                listeners.JSONLiteral = (node: JSONLiteral) => handleJSONLiteral(node);
            }

            if (options.checkJSXText) {
                listeners.JSXText = handleJSXText;
            }

            if (options.checkStringTemplates) {
                listeners.TemplateElement = handleTemplateElement;
            }

            if (options.checkIdentifiers || options.ignoreImports) {
                // Include identifier handler if checking identifiers OR handling imports
                listeners.Identifier = (node: Identifier) => {
                    // Process the identifier
                    handleIdentifier(node);
                    
                    // Optionally process comments attached to this node
                    // This is an alternative approach for incremental comment processing
                    // Currently disabled in favor of the bulk processing approach
                    // processNodeComments(node);
                };
            }

            /**
             * Unified Program:exit handler that processes all collected data.
             * This approach is more robust than chaining multiple Program:exit handlers.
             * 
             * Processing order:
             * 1. Process comments (if enabled)
             * 2. Process collected text ranges with spell checker
             * 3. Report any errors or issues found
             */
            listeners['Program:exit'] = (node: Program) => {
                // Step 1: Process all comments using robust direct approach
                if (options.checkComments) {
                    processAllComments();
                }

                // Step 2: Process collected text ranges with spell checker
                if (toBeChecked.length > 0) {
                    const filename = context.filename || context.getFilename();
                    const sourceCode = context.sourceCode || context.getSourceCode();
                    if (sourceCode) {
                        try {
                            const result = spellCheck(
                                filename,
                                sourceCode.text,
                                toBeChecked.map((t) => t.range),
                                options,
                            );
                            
                            // Step 3a: Report any worker errors
                            if (result.errors && result.errors.length) {
                                log(
                                    'Spell check worker errors: %o',
                                    result.errors.map((e) => e.message),
                                );
                                result.errors.forEach((error) => 
                                    context.report({ 
                                        message: error.message, 
                                        loc: { line: 1, column: 1 } 
                                    })
                                );
                            }
                            
                            // Step 3b: Report spelling issues
                            result.issues.forEach((issue) => {
                                const convertedIssue = createIssueFromSpellCheckResult(issue, issue.rangeIdx);
                                reportIssue(convertedIssue);
                            });

                            log('Processed %d text ranges, found %d spelling issues', 
                                toBeChecked.length, result.issues.length);
                        } catch (error) {
                            log('Spell check error: %o', error);
                            context.report({
                                message: `Spell check failed: ${error}`,
                                loc: { line: 1, column: 1 }
                            });
                        }
                    }
                } else {
                    log('No text ranges collected for spell checking');
                }
                
                // Step 4: Report parent tracking statistics
                reportParentTrackingStats();
            };
        }

        return listeners;
    }

    return buildRuleListeners();
}

const spellchecker: Rule.RuleModule = {
    meta: ruleMeta,
    create,
};

export const rules: { spellchecker: Rule.RuleModule } = {
    spellchecker,
} satisfies ESlintPlugin['rules'];

function logContext(log: typeof console.log, context: Rule.RuleContext) {
    log('context: %o', {
        id: context.id,
        cwd: context.cwd,
        filename: context.filename,
        physicalFilename: context.physicalFilename,
        // scope: context.getScope().type,
        options: context.options.length === 1 ? context.options[0] : context.options,
    });
}

function contextSourceCode(context: Rule.RuleContext): Rule.RuleContext['sourceCode'] {
    return context.sourceCode || context.getSourceCode();
}

export const meta = { name: '@cspell' } as const;

const recommended: ESLint.ConfigData = {
    plugins: ['@cspell'],
    rules: {
        '@cspell/spellchecker': ['warn', {}],
    },
};

const debugConfig: ESLint.ConfigData = {
    plugins: ['@cspell'],
    rules: {
        '@cspell/spellchecker': ['warn', { debugMode: true }],
    },
};

export const configs: ESlintPlugin['configs'] = {
    debug: debugConfig,
    'debug-legacy': debugConfig,
    recommended,
    'recommended-legacy': recommended,
};

export const plugin: ESlintPlugin = { rules, configs, meta } satisfies ESlintPlugin;
