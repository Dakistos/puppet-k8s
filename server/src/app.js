import {fetchUrls, puppetize} from './lib';

import * as os from 'os';

const db = require('../models');

import bodyParser from 'body-parser';
import express from 'express';

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

main().then(async () => {
    app.use(bodyParser.json());

    app.post('/process', async (req, res) => {
        const {url} = req.body;

        const collectionPath = await fetchUrls({url: url});

        await cluster.queue(collectionPath, puppetize(collectionPath))

        res.json({
            success: true,
            message: `Queued ${url} for processing!`,
            data: {
                numUrls: collectionPath,
                workerId: os.hostname(),
            },
        });
    });

    app.get('/', (req, res) => {
        console.log('On change');
    });
});

module.exports = http;
