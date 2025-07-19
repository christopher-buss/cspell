// Large file for stress testing performance
// This file contains extensive code to test performance under load

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Constants and configuration
const VERSION = '2.0.0';
const DEFAULT_PORT = 8080;
const MAX_CONNECTIONS = 1000;
const TIMEOUT_DURATION = 30_000;
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16_000];
const SUPPORTED_FORMATS = ['json', 'xml', 'csv', 'yaml'];
// const _COMPRESSION_THRESHOLD = 1024; // 1KB - Unused for now

/**
 * DataProcessingService handles large-scale data operations
 * including parsing, transformation, validation, and storage
 */
class DataProcessingService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = this.validateConfig(config);
        this.processors = new Map();
        this.validators = new Map();
        this.transformers = new Map();
        this.cache = new Map();
        this.metrics = {
            processed: 0,
            failed: 0,
            cached: 0,
            transformations: 0,
        };
        this.initializeService();
    }

    validateConfig(config) {
        const defaults = {
            port: DEFAULT_PORT,
            maxConnections: MAX_CONNECTIONS,
            timeout: TIMEOUT_DURATION,
            compressionEnabled: true,
            cacheEnabled: true,
            metricsEnabled: true,
            retryEnabled: true,
            formats: SUPPORTED_FORMATS,
        };

        return { ...defaults, ...config };
    }

    async initializeService() {
        try {
            // Register default processors
            this.registerProcessor('json', this.processJSON.bind(this));
            this.registerProcessor('xml', this.processXML.bind(this));
            this.registerProcessor('csv', this.processCSV.bind(this));
            this.registerProcessor('yaml', this.processYAML.bind(this));

            // Register default validators
            this.registerValidator('schema', this.validateSchema.bind(this));
            this.registerValidator('format', this.validateFormat.bind(this));
            this.registerValidator('business', this.validateBusinessRules.bind(this));

            // Register default transformers
            this.registerTransformer('normalize', this.normalizeData.bind(this));
            this.registerTransformer('aggregate', this.aggregateData.bind(this));
            this.registerTransformer('filter', this.filterData.bind(this));
            this.registerTransformer('map', this.mapData.bind(this));

            // Load plugins if available
            await this.loadPlugins();

            this.emit('initialized', {
                version: VERSION,
                processors: [...this.processors.keys()],
                validators: [...this.validators.keys()],
                transformers: [...this.transformers.keys()],
            });
        } catch (error) {
            this.handleError('Initialization failed', error);
        }
    }

    /**
     * Process incoming data based on format
     * @param {Buffer|string} data - Raw data to process
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processed data
     */
    async processData(data, options = {}) {
        const startTime = Date.now();

        try {
            // Decompress if needed
            if (options.compressed) {
                data = await this.decompressData(data);
            }

            // Detect format if not specified
            const format = options.format || this.detectFormat(data);

            // Check cache
            const cacheKey = this.generateCacheKey(data, format, options);
            if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
                this.metrics.cached++;
                return this.cache.get(cacheKey);
            }

            // Get appropriate processor
            const processor = this.processors.get(format);
            if (!processor) {
                throw new Error(`Unsupported format: ${format}`);
            }

            // Process the data
            let result = await processor(data, options);

            // Validate if required
            if (options.validate) {
                await this.validateData(result, options.validationRules);
            }

            // Transform if required
            if (options.transformations) {
                result = await this.applyTransformations(result, options.transformations);
            }

            // Cache the result
            if (this.config.cacheEnabled) {
                this.cache.set(cacheKey, result);
            }

            // Update metrics
            this.metrics.processed++;

            // Emit success event
            this.emit('dataProcessed', {
                format,
                size: data.length,
                duration: Date.now() - startTime,
                transformed: !!options.transformations,
                validated: !!options.validate,
            });

            return result;

        } catch (error) {
            this.metrics.failed++;
            this.handleError('Data processing failed', error);

            // Retry if enabled
            if (this.config.retryEnabled && options.retryCount < RETRY_DELAYS.length) {
                const delay = RETRY_DELAYS[options.retryCount || 0];
                await this.delay(delay);
                return this.processData(data, {
                    ...options,
                    retryCount: (options.retryCount || 0) + 1,
                });
            }

            throw error;
        }
    }

    /**
     * Register a custom processor
     * @param {string} format - Format name
     * @param {Function} processor - Processor function
     */
    registerProcessor(format, processor) {
        if (typeof processor !== 'function') {
            throw new TypeError('Processor must be a function');
        }
        this.processors.set(format, processor);
        this.emit('processorRegistered', { format });
    }

    /**
     * Register a custom validator
     * @param {string} name - Validator name
     * @param {Function} validator - Validator function
     */
    registerValidator(name, validator) {
        if (typeof validator !== 'function') {
            throw new TypeError('Validator must be a function');
        }
        this.validators.set(name, validator);
        this.emit('validatorRegistered', { name });
    }

    /**
     * Register a custom transformer
     * @param {string} name - Transformer name
     * @param {Function} transformer - Transformer function
     */
    registerTransformer(name, transformer) {
        if (typeof transformer !== 'function') {
            throw new TypeError('Transformer must be a function');
        }
        this.transformers.set(name, transformer);
        this.emit('transformerRegistered', { name });
    }

    // Data processors
    async processJSON(data, _options) {
        try {
            const parsed = JSON.parse(data.toString());
            return this.enrichData(parsed, 'json');
        } catch (error) {
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    }

    async processXML(data, _options) {
        // Simulated XML processing
        const result = {
            type: 'xml',
            data: data.toString(),
            parsed: { root: {} },
        };
        return this.enrichData(result, 'xml');
    }

    async processCSV(data, _options) {
        // Simulated CSV processing
        const lines = data.toString().split('\n');
        const headers = lines[0].split(',');
        const rows = lines.slice(1).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index];
                return obj;
            }, {});
        });

        return this.enrichData({ headers, rows }, 'csv');
    }

    async processYAML(data, _options) {
        // Simulated YAML processing
        const result = {
            type: 'yaml',
            data: data.toString(),
            parsed: {},
        };
        return this.enrichData(result, 'yaml');
    }

    // Data validators
    async validateSchema(data, schema) {
        // Simulated schema validation
        const errors = [];

        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in data)) {
                    errors.push(`Missing required field: ${field}`);
                }
            }
        }

        // Check field types
        if (schema.properties) {
            for (const [field, config] of Object.entries(schema.properties)) {
                if (field in data) {
                    const value = data[field];
                    const type = typeof value;
                    if (config.type && type !== config.type) {
                        errors.push(`Invalid type for ${field}: expected ${config.type}, got ${type}`);
                    }
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Schema validation failed: ${errors.join(', ')}`);
        }

        return true;
    }

    async validateFormat(data, rules) {
        // Simulated format validation
        const errors = [];

        if (rules.minLength && JSON.stringify(data).length < rules.minLength) {
            errors.push(`Data too small: minimum length is ${rules.minLength}`);
        }

        if (rules.maxLength && JSON.stringify(data).length > rules.maxLength) {
            errors.push(`Data too large: maximum length is ${rules.maxLength}`);
        }

        if (errors.length > 0) {
            throw new Error(`Format validation failed: ${errors.join(', ')}`);
        }

        return true;
    }

    async validateBusinessRules(data, rules) {
        // Simulated business rule validation
        for (const rule of rules) {
            const result = await rule.validate(data);
            if (!result.valid) {
                throw new Error(`Business rule validation failed: ${result.message}`);
            }
        }
        return true;
    }

    // Data transformers
    async normalizeData(data, config) {
        this.metrics.transformations++;

        // Deep clone the data
        const normalized = JSON.parse(JSON.stringify(data));

        // Apply normalization rules
        if (config.lowercase) {
            this.applyToStrings(normalized, str => str.toLowerCase());
        }

        if (config.trim) {
            this.applyToStrings(normalized, str => str.trim());
        }

        if (config.removeNulls) {
            this.removeNullValues(normalized);
        }

        return normalized;
    }

    async aggregateData(data, config) {
        this.metrics.transformations++;

        const aggregated = {};

        if (config.groupBy) {
            // Group data by specified field
            const groups = this.groupBy(data, config.groupBy);

            // Apply aggregation functions
            for (const [group, items] of Object.entries(groups)) {
                aggregated[group] = {};

                if (config.count) {
                    aggregated[group].count = items.length;
                }

                if (config.sum) {
                    for (const field of config.sum) {
                        aggregated[group][`sum_${field}`] = items.reduce((sum, item) => sum + (item[field] || 0), 0);
                    }
                }

                if (config.avg) {
                    for (const field of config.avg) {
                        const sum = items.reduce((sum, item) => sum + (item[field] || 0), 0);
                        aggregated[group][`avg_${field}`] = sum / items.length;
                    }
                }
            }
        }

        return aggregated;
    }

    async filterData(data, config) {
        this.metrics.transformations++;

        let filtered = Array.isArray(data) ? data : [data];

        // Apply filters
        for (const filter of config.filters) {
            filtered = filtered.filter(item => {
                switch (filter.operator) {
                    case 'eq': {
                        return item[filter.field] === filter.value;
                    }
                    case 'ne': {
                        return item[filter.field] !== filter.value;
                    }
                    case 'gt': {
                        return item[filter.field] > filter.value;
                    }
                    case 'lt': {
                        return item[filter.field] < filter.value;
                    }
                    case 'contains': {
                        return String(item[filter.field]).includes(filter.value);
                    }
                    case 'regex': {
                        return new RegExp(filter.value).test(item[filter.field]);
                    }
                    default: {
                        return true;
                    }
                }
            });
        }

        return filtered;
    }

    async mapData(data, config) {
        this.metrics.transformations++;

        const mapped = Array.isArray(data) ? data : [data];

        return mapped.map(item => {
            const result = {};

            // Apply field mappings
            for (const [source, target] of Object.entries(config.fieldMap)) {
                if (source in item) {
                    result[target] = item[source];
                }
            }

            // Apply transformations
            if (config.transforms) {
                for (const [field, transform] of Object.entries(config.transforms)) {
                    if (field in result) {
                        result[field] = this.applyFieldTransform(result[field], transform);
                    }
                }
            }

            return result;
        });
    }

    // Helper methods
    async decompressData(data) {
        try {
            return await gunzip(data);
        } catch (error) {
            throw new Error(`Decompression failed: ${error.message}`);
        }
    }

    async compressData(data) {
        if (data.length < this.config.compressionThreshold) {
            return data;
        }

        try {
            return await gzip(data);
        } catch (error) {
            throw new Error(`Compression failed: ${error.message}`);
        }
    }

    detectFormat(data) {
        const str = data.toString().trim();

        if (str.startsWith('{') || str.startsWith('[')) {
            return 'json';
        } else if (str.startsWith('<?xml') || str.startsWith('<')) {
            return 'xml';
        } else if (str.includes(',') && str.includes('\n')) {
            return 'csv';
        } else if (str.includes(':') && (str.includes('\n-') || str.includes('\n '))) {
            return 'yaml';
        }

        return 'unknown';
    }

    generateCacheKey(data, format, options) {
        const hash = crypto.createHash('sha256');
        hash.update(data);
        hash.update(format);
        hash.update(JSON.stringify(options));
        return hash.digest('hex');
    }

    enrichData(data, format) {
        return {
            ...data,
            _metadata: {
                format,
                processedAt: new Date().toISOString(),
                version: VERSION,
            },
        };
    }

    applyToStrings(obj, fn) {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = fn(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.applyToStrings(obj[key], fn);
            }
        }
    }

    removeNullValues(obj) {
        for (const key in obj) {
            if (obj[key] === null || obj[key] === undefined) {
                delete obj[key];
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.removeNullValues(obj[key]);
            }
        }
    }

    groupBy(array, field) {
        return array.reduce((groups, item) => {
            const key = item[field];
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    }

    applyFieldTransform(value, transform) {
        switch (transform.type) {
            case 'uppercase': {
                return String(value).toUpperCase();
            }
            case 'lowercase': {
                return String(value).toLowerCase();
            }
            case 'number': {
                return Number(value);
            }
            case 'boolean': {
                return Boolean(value);
            }
            case 'date': {
                return new Date(value).toISOString();
            }
            case 'custom': {
                return transform.fn(value);
            }
            default: {
                return value;
            }
        }
    }

    async applyTransformations(data, transformations) {
        let result = data;

        for (const transformation of transformations) {
            const transformer = this.transformers.get(transformation.type);
            if (!transformer) {
                throw new Error(`Unknown transformer: ${transformation.type}`);
            }

            result = await transformer(result, transformation.config);
        }

        return result;
    }

    async validateData(data, rules) {
        for (const rule of rules) {
            const validator = this.validators.get(rule.type);
            if (!validator) {
                throw new Error(`Unknown validator: ${rule.type}`);
            }

            await validator(data, rule.config);
        }
    }

    async loadPlugins() {
        const pluginsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'plugins');

        try {
            const files = await fs.readdir(pluginsDir);

            for (const file of files) {
                if (file.endsWith('.js')) {
                    // const _pluginPath = path.join(pluginsDir, file);
                    // In real implementation, would dynamically import
                    this.emit('pluginLoaded', { name: file });
                }
            }
        } catch {
            // Plugins directory might not exist
            this.emit('pluginsNotFound');
        }
    }

    handleError(message, error) {
        const errorInfo = {
            message,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
        };

        this.emit('error', errorInfo);

        if (this.config.throwErrors) {
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        };
    }

    clearCache() {
        const size = this.cache.size;
        this.cache.clear();
        this.emit('cacheCleared', { size });
    }

    shutdown() {
        this.clearCache();
        this.removeAllListeners();
        this.emit('shutdown');
    }
}

// Additional helper functions
function createDataProcessor(config) {
    return new DataProcessingService(config);
}

function validateConfiguration(config) {
    const required = ['port', 'maxConnections'];
    const missing = required.filter(key => !(key in config));

    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    return true;
}

// Export everything
export {
    createDataProcessor,
    DataProcessingService,
    SUPPORTED_FORMATS,
    validateConfiguration,
    VERSION,
};

export default DataProcessingService;