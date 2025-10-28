import {
    dummyPaymentHandler,
    DefaultJobQueuePlugin,
    DefaultSchedulerPlugin,
    VendureConfig,
    DefaultSearchPlugin,
    LanguageCode,
    Asset
} from '@vendure/core';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader,  } from '@vendure/email-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import 'dotenv/config';
import path from 'path';
import { StripePlugin } from '@vendure/payments-plugin/package/stripe';
import { MultivendorPlugin } from './plugins/multivendor/multivendor.plugin';
import { ElasticsearchPlugin } from '@vendure/elasticsearch-plugin';
import { ProductSellersPlugin } from './plugins/product-sellers/product-sellers.plugin';
import { MarketplacePaymentPlugin } from './plugins/marketplace-payment/marketplace-payment.plugin';


// import { compileUiExtensions, setBranding } from '@vendure/ui-devkit/compiler';

const IS_DEV = process.env.APP_ENV === 'dev';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// Cloud Run inyecta la variable PORT, usar ese valor o default 3002
const serverPort = parseInt(process.env.PORT || '3002', 10);

// console log all the process.env variables
console.log('=== ENVIRONMENT VARIABLES ===');
console.log('PORT:', process.env.PORT);
console.log('serverPort (computed):', serverPort);
console.log('IS_PRODUCTION:', IS_PRODUCTION);
console.log('IS_DEV:', IS_DEV);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USERNAME:', process.env.DB_USERNAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : 'NOT SET');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('APP_ENV:', process.env.APP_ENV);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('ADMIN_UI_API_HOST:', process.env.ADMIN_UI_API_HOST);
console.log('==============================');

export const config: VendureConfig = {
    apiOptions: {
        port: serverPort,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        trustProxy: IS_PRODUCTION, // Only enable in production
        // The following options are useful in development mode,
        // but are best turned off for production for security
        // reasons.
        ...(IS_DEV ? {
            adminApiDebug: true,
            shopApiDebug: true,
        } : {}),
        cors: {
            // Permitir orígenes en desarrollo y producción
            origin: IS_PRODUCTION 
                ? [process.env.FRONTEND_URL || 'https://gcommerce.glass', 'http://localhost:3000', 'http://localhost:3001']
                : ['http://localhost:3000', 'http://localhost:3001'],
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'vendure-token'],
        },
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
            secret: process.env.COOKIE_SECRET,
            ...(IS_PRODUCTION ? {
                sameSite: 'none',
                secure: true,
            } : {
                sameSite: 'lax',
                secure: false,
            }),
        },
    },
    dbConnectionOptions: {
        type: 'postgres',
        // See the README.md "Migrations" section for an explanation of
        // the `synchronize` and `migrations` options.
        synchronize: true, // Temporalmente habilitado para crear las tablas en staging
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: IS_DEV, // Enable logging in development
        database: process.env.DB_NAME,
        schema: process.env.DB_SCHEMA,
        host: process.env.DB_HOST,
        port: +process.env.DB_PORT,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        // Pool de conexiones para evitar errores de conexión
        extra: {
            max: 10, // Máximo 10 conexiones
            min: 2,  // Mínimo 2 conexiones
            acquire: 30000, // Timeout de 30 segundos
            idle: 10000,    // Cerrar conexiones inactivas después de 10 segundos
        },
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    customFields: {
        Seller: [
            {
                name: 'agencyId',
                type: 'string',
                label: [{ languageCode: LanguageCode.en, value: 'Agency ID' }],
                description: [{ languageCode: LanguageCode.en, value: 'The agency ID associated with this seller' }],
            },
            {
                name: 'agencyName',
                type: 'string',
                label: [{ languageCode: LanguageCode.en, value: 'Agency Name' }],
                description: [{ languageCode: LanguageCode.en, value: 'The name of the agency' }],
            },
            {
                name: 'agencyCode',
                type: 'string',
                label: [{ languageCode: LanguageCode.en, value: 'Agency Code' }],
                description: [{ languageCode: LanguageCode.en, value: 'The code of the agency' }],
            },
            {
                name: 'agencyEmail',
                type: 'string',
                label: [{ languageCode: LanguageCode.en, value: 'Agency Email' }],
                description: [{ languageCode: LanguageCode.en, value: 'The email of the agency' }],
            },
            {
                name: 'agencyPhone',
                type: 'string',
                label: [{ languageCode: LanguageCode.en, value: 'Agency Phone' }],
                description: [{ languageCode: LanguageCode.en, value: 'The phone of the agency' }],
            },
        ],
        OrderLine: [
            {
                name: 'selectedSellerChannelId',
                type: 'string',
                label: [{ languageCode: LanguageCode.en, value: 'Selected Seller Channel ID' }],
                description: [{ languageCode: LanguageCode.en, value: 'The selected seller channel ID for this order line' }],
            },
            {
                name: 'sellerChannelCode',
                type: 'string',
                label: [{ languageCode: LanguageCode.en, value: 'Seller Channel Code' }],
                description: [{ languageCode: LanguageCode.en, value: 'The code of the seller channel for this order line' }],
            },
        ],
    },
    plugins: [
        GraphiqlPlugin.init(),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, '../static/assets'),
            // For local dev, the correct value for assetUrlPrefix should
            // be guessed correctly, but for production it will usually need
            // to be set manually to match your production url.
            assetUrlPrefix: IS_DEV ? undefined : 'https://www.my-shop.com/assets/',
        }),
        DefaultSchedulerPlugin.init(),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false }), // Disabled to use Elasticsearch 
        EmailPlugin.init({
            devMode: true,
            outputPath: path.join(__dirname, '../static/email/test-emails'),
            route: 'mailbox',
            handlers: defaultEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
            globalTemplateVars: {
                // The following variables will change depending on your storefront implementation.
                // Here we are assuming a storefront running at http://localhost:8080.
                fromAddress: '"example" <noreply@example.com>',
                verifyEmailAddressUrl: 'http://localhost:3001/verify',
                passwordResetUrl: 'http://localhost:3001/password-reset',
                changeEmailAddressUrl: 'http://localhost:3001/verify-email-address-change'
            },
            transport: {
                type: 'smtp',
                host: process.env.SMTP_HOST,
                port: 587,
                auth: {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASSWORD
                }
            }
        }),
        AdminUiPlugin.init({
            route: 'admin',
            port: serverPort,
            adminUiConfig: {
                apiPort: IS_PRODUCTION ? 443 : serverPort,
                apiHost: process.env.ADMIN_UI_API_HOST,
                brand: 'Glass Next',
                hideVendureBranding: true,
                hideVersion: false,
                loginImageUrl: "https://gcommerce.glass/design/backend/media/images/addons/glass_vendors/admin-login-background.jpg?1747208220",
            },
            // app: compileUiExtensions({
            //     outputPath: path.join(__dirname, '../admin-ui'),
            //     extensions: [
            //         setBranding({
            //             // The small logo appears in the top left of the screen  
            //             smallLogoPath: path.join(__dirname, 'assets/images/logo-top.webp'),
            //             // The large logo is used on the login page  
            //             largeLogoPath: path.join(__dirname, 'assets/images/logo-login.webp'),
            //             faviconPath: path.join(__dirname, 'assets/images/favicon.ico'),
            //         }),
            //     ],
            //     devMode: true,
            // }),
        }),
        MultivendorPlugin.init({
            platformFeePercent: 10,
            platformFeeSKU: 'platform-fee',
        }),
        StripePlugin.init({
            // This prevents different customers from using the same PaymentIntent
            storeCustomersInStripe: true,
            paymentIntentCreateParams(injector, ctx, order) {
                return {
                    description: `Order #${order.code} for ${order.customer?.emailAddress}`,
                }
            },
        }),
        // Solo inicializar Elasticsearch si está configurado
        ...(process.env.ELASTICSEARCH_HOST ? [ElasticsearchPlugin.init({
            host: process.env.ELASTICSEARCH_HOST,
            port: parseInt(process.env.ELASTICSEARCH_PORT || '9200'),
            indexPrefix: 'vendure',
        })] : []),
        ProductSellersPlugin.init({}),
        MarketplacePaymentPlugin.init({
            platformFeePercent: 10,
            platformFeeSKU: 'platform-fee',
            autoPayouts: false,
            minimumPayoutAmount: 1000,
        }),
    
    ],
};
