import {fetchUrls, puppetize} from './lib';
import * as os from 'os';
import bodyParser from 'body-parser';
import express from 'express';

const db = require('../models');
const app = express();
const http = require('http').Server(app);
// const kue = require('kue');


const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// puppeteer.use(StealthPlugin());

const {Cluster} = require('puppeteer-cluster');

let cluster;

async function createCluster() {
    return await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_PAGE,
        maxConcurrency: 3,
        sameDomainDelay: 3000, // data should be an url or an object containing the "url" field.
        // puppeteer: puppeteer,
        monitor: false,
        puppeteerOptions: {
            headless: false,
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
    let analysedUrls = 0;

    cluster = await createCluster();
    const collectionPath = await fetchUrls({url});

    // Get previous stored Urls
    const crawlsRef = await db.websitesurl;
    const dbUrls = await crawlsRef.findAll({
        where: {
            sourceUrl: url
        },
        attributes: ['url']
    });
    const stringUrls = JSON.stringify(dbUrls);
    const existedUrls = JSON.parse(stringUrls);

    // Loop though urls
    existedUrls.map(async el => {
        console.log(el.url);
        await cluster.queue({url: el.url}, puppetize);
        analysedUrls = analysedUrls += 1;
        console.log("Urls analysées :", analysedUrls);
    });

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
