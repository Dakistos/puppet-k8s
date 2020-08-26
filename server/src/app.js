import {fetchUrls, puppetize} from './lib';

import * as os from 'os';

const db = require('../models');

import bodyParser from 'body-parser';
import express from 'express';
import {col} from "sequelize";
// import {cors} from "cors";
// import kue from 'kue';
//
// const queue = kue.createQueue();

const app = express();
const http = require('http').Server(app);

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const {Cluster} = require('puppeteer-cluster');

let cluster;

async function createCluster() {
    return await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 5,
        sameDomainDelay: 3, // data should be an url or an object containing the "url" field.
        puppeteer: puppeteer,
        puppeteerOptions: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        },
    });
}

const main = async () => {
    cluster = await createCluster();
};

// queue.process('analyze', async (job, done) => {
//     console.log('Started background job:', job.id);
//
//     // invoke a new pool of puppeteers
//     const cluster = await createCluster();
//
//     job.data.url.map(async doc => {
//         await cluster.queue({doc, cmpSelector: job.data.cmpSelector}, puppetize);
//     });
//
//     // wait for pool to be done the close them.
//     await cluster.idle();
//     await cluster.close();
//
//     console.log('Cluster done, closing.');
//
//     done();
// });

// app.use(cors());
app.use(bodyParser.json());
// app.use('kue-ui', kue.app);

app.post('/process', async (req, res) => {
    const {url} = req.body;

    cluster = await createCluster();
    const collectionPath = await fetchUrls({url});
    await cluster.queue({url}, puppetize);

    res.json({
        success: true,
        message: `Queued ${url} for processing!`,
        data: {
            url: url,
            workerId: os.hostname(),
            collectionPath: collectionPath
        },
    });
});

app.get('/', (req, res) => {
    console.log('On change');
});

module.exports = http;
