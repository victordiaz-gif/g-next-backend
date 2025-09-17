import { populate } from '@vendure/core/cli';
import { bootstrap } from '@vendure/core';
import { config } from './vendure-config';
import path from 'path';

populate(
    () => bootstrap({
        ...config,
        importExportOptions: {
            importAssetsDir: path.join(
                require.resolve('@vendure/create/assets/products.csv'),
                '../images'
            ),
        },
        dbConnectionOptions: { ...config.dbConnectionOptions, synchronize: true }
    }),
    require('@vendure/create/assets/initial-data.json'),
    require.resolve('@vendure/create/assets/products.csv')
)
    .then(app => app.close())
    .catch(err => {
        console.log(err);
        process.exit(1);
    });