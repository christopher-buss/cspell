// String-heavy file to test string literal spell checking performance
// Contains many string literals, template strings, and string operations

const APP_MESSAGES = {
    // User interface messages
    welcome: "Welcome to our application! We're excited to have you here.",
    dashboard: {
        title: "Dashboard Overview",
        subtitle: "Here's what's happening in your account today",
        widgets: {
            statistics: "Statistics and Analytics",
            notifications: "Recent Notifications",
            activities: "Latest Activities",
            performance: "Performance Metrics",
        },
    },

    // Form validation messages
    validation: {
        required: "This field is required",
        email: "Please enter a valid email address",
        password: "Password must be at least 8 characters long",
        passwordMatch: "Passwords do not match",
        username: "Username must be between 3 and 20 characters",
        phone: "Please enter a valid phone number",
        url: "Please enter a valid URL",
        date: "Please enter a valid date",
        number: "Please enter a valid number",
        minLength: "Minimum length is {min} characters",
        maxLength: "Maximum length is {max} characters",
        pattern: "Please match the requested format",
    },

    // Error messages
    errors: {
        generic: "An unexpected error occurred. Please try again later.",
        network: "Network connection failed. Please check your internet connection.",
        server: "Server error. Our team has been notified.",
        notFound: "The requested resource was not found.",
        unauthorized: "You are not authorized to perform this action.",
        forbidden: "Access to this resource is forbidden.",
        timeout: "The request timed out. Please try again.",
        maintenance: "We're currently performing maintenance. Please check back soon.",
    },

    // Success messages
    success: {
        saved: "Your changes have been saved successfully.",
        deleted: "The item has been deleted successfully.",
        updated: "The information has been updated successfully.",
        created: "New item has been created successfully.",
        sent: "Your message has been sent successfully.",
        uploaded: "File uploaded successfully.",
        downloaded: "File downloaded successfully.",
    },
};

// Product descriptions
const PRODUCT_CATALOG = [
    {
        id: "prod-001",
        name: "Premium Wireless Headphones",
        description: "Experience crystal-clear audio with our premium wireless headphones. Features include active noise cancellation, 30-hour battery life, and comfortable over-ear design.",
        features: [
            "Active noise cancellation technology",
            "30-hour battery life on a single charge",
            "Bluetooth 5.0 connectivity",
            "Comfortable memory foam ear cushions",
            "Foldable design for easy portability",
        ],
        specifications: `
            Frequency Response: 20Hz - 20kHz
            Driver Size: 40mm
            Impedance: 32 ohms
            Sensitivity: 105dB
            Bluetooth Version: 5.0
            Battery Life: Up to 30 hours
            Charging Time: 2 hours
            Weight: 250g
        `,
    },
    {
        id: "prod-002",
        name: "Smart Fitness Tracker",
        description: "Track your fitness goals with our advanced smart fitness tracker. Monitor heart rate, sleep patterns, steps, calories, and more.",
        features: [
            "24/7 heart rate monitoring",
            "Sleep tracking and analysis",
            "Water-resistant up to 50 meters",
            "GPS tracking for outdoor activities",
            "7-day battery life",
        ],
        specifications: `
            Display: 1.4" AMOLED touchscreen
            Resolution: 320 x 320 pixels
            Sensors: Heart rate, accelerometer, gyroscope, GPS
            Battery: 200mAh lithium-polymer
            Connectivity: Bluetooth 4.2
            Water Resistance: 5ATM
            Compatibility: iOS 10+ and Android 5.0+
        `,
    },
];

// Template string examples
function generateEmailTemplate(user, order, company) {
    return `
        Dear ${user.firstName} ${user.lastName},
        
        Thank you for your recent order #${order.id}!
        
        We're pleased to confirm that we've received your order and it's being processed.
        Here's a summary of your purchase:
        
        Order Date: ${new Date(order.date).toLocaleDateString()}
        Order Total: $${order.total.toFixed(2)}
        Shipping Address: ${order.shippingAddress}
        
        Items Ordered:
        ${order.items.map(item => `- ${item.name} (Qty: ${item.quantity}) - $${item.price.toFixed(2)}`).join('\n')}
        
        Estimated Delivery: ${order.estimatedDelivery}
        
        You can track your order status at any time by visiting your account dashboard.
        
        If you have any questions about your order, please don't hesitate to contact our customer service team.
        
        Best regards,
        The ${company.name} Team
    `;
}

// Multi-line strings
const TERMS_OF_SERVICE = `
Terms of Service Agreement

Last Updated: January 1, 2024

1. ACCEPTANCE OF TERMS
By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.

2. USE LICENSE
Permission is granted to temporarily download one copy of the materials (information or software) on our service for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.

3. DISCLAIMER
The materials on our service are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.

4. LIMITATIONS
In no event shall our company or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our service, even if we or our authorized representative has been notified orally or in writing of the possibility of such damage.
`;

// Internationalization strings
const TRANSLATIONS = {
    en: {
        greeting: "Hello",
        farewell: "Goodbye",
        thankYou: "Thank you",
        yes: "Yes",
        no: "No",
        please: "Please",
        sorry: "Sorry",
        welcome: "Welcome",
    },
    es: {
        greeting: "Hola",
        farewell: "Adiós",
        thankYou: "Gracias",
        yes: "Sí",
        no: "No",
        please: "Por favor",
        sorry: "Lo siento",
        welcome: "Bienvenido",
    },
    fr: {
        greeting: "Bonjour",
        farewell: "Au revoir",
        thankYou: "Merci",
        yes: "Oui",
        no: "Non",
        please: "S'il vous plaît",
        sorry: "Désolé",
        welcome: "Bienvenue",
    },
};

// Dynamic string generation
function createDynamicStrings() {
    const strings = [];

    // Generate user messages
    for (let i = 1; i <= 10; i++) {
        strings.push(`User notification #${i}: Your action has been completed successfully.`);
        strings.push(`System message #${i}: Please review the following information carefully.`);
        strings.push(`Alert #${i}: This requires your immediate attention.`);
    }

    // Generate product reviews
    const reviewTemplates = [
        "This product exceeded my expectations. Highly recommended!",
        "Great quality and fast shipping. Would buy again.",
        "Exactly as described. Very satisfied with my purchase.",
        "Outstanding customer service and product quality.",
        "Best purchase I've made this year. Five stars!",
    ];

    reviewTemplates.forEach((template, index) => {
        strings.push(`Review ${index + 1}: ${template}`);
    });

    return strings;
}

// Configuration strings
const CONFIG_STRINGS = {
    api: {
        baseUrl: "https://api.example.com/v1",
        endpoints: {
            users: "/users",
            products: "/products",
            orders: "/orders",
            reviews: "/reviews",
            analytics: "/analytics",
        },
        headers: {
            contentType: "application/json",
            accept: "application/json",
            authorization: "Bearer {token}",
        },
    },
    database: {
        connection: "postgresql://username:password@localhost:5432/database",
        options: {
            pool: "max=10,min=2,idleTimeoutMillis=30000",
            ssl: "require",
            statement_timeout: "30000",
        },
    },
    logging: {
        format: "[{timestamp}] {level}: {message}",
        levels: ["error", "warn", "info", "debug", "trace"],
        output: "logs/application-{date}.log",
    },
};

// More string constants
const REGEX_PATTERNS = {
    email: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    phone: "^\\+?[1-9]\\d{1,14}$",
    url: "^https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)$",
    ipAddress: "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
    creditCard: "^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$",
};

// Export all strings
export {
    APP_MESSAGES,
    CONFIG_STRINGS,
    createDynamicStrings,
    generateEmailTemplate,
    PRODUCT_CATALOG,
    REGEX_PATTERNS,
    TERMS_OF_SERVICE,
    TRANSLATIONS,
};