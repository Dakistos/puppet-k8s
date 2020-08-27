import {fetchUrls, puppetize} from './lib';
import * as os from 'os';
import bodyParser from 'body-parser';
import express from 'express';

const db = require('../models');
const app = express();
const http = require('http').Server(app);

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// puppeteer.use(StealthPlugin());

const {Cluster} = require('puppeteer-cluster');

let cluster;


async function createCluster() {
    return await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 3,
        sameDomainDelay: 3, // data should be an url or an object containing the "url" field.
        // puppeteer: puppeteer,
        puppeteerOptions: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
            defaultViewport: null
        },
    });
}

const main = async () => {
    cluster = await createCluster();
};

// app.use(cors());
app.use(bodyParser.json());

app.post('/process', async (req, res) => {
    const {url} = req.body;

    cluster = await createCluster();
    const collectionPath = await fetchUrls({url});

    // const crawlsRef = await db.websitesurl;
    // const dbUrls = await crawlsRef.findAll({
    //     where: {
    //         sourceUrl: url
    //     },
    //     attributes: ['url']
    // });
    console.log(collectionPath[0].url);
    const test = collectionPath[0].url;
    // const stringUrls = JSON.stringify(dbUrls);
    // const existedUrls = JSON.parse(stringUrls);
    await cluster.queue({test}, puppetize);
    // existedUrls.map(async el => {
    //     let url = el.url;
    //     console.log(url);
    //     await cluster.queue({url}, puppetize);
    // });
    // console.log(existedUrls);
    await cluster.idle();
    await cluster.close();

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
