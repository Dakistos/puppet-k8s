import * as os from 'os';
import setCookie from 'set-cookie-parser';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const db = require('../../models');

const autoScroll = async (page) => {
    await page.evaluate(() => new Promise((resolve) => {
        let scrollTop = -1;
        const interval = setInterval(() => {
            window.scrollBy(0, 100);
            if (document.documentElement.scrollTop !== scrollTop) {
                scrollTop = document.documentElement.scrollTop;

                return;
            }
            clearInterval(interval);
            resolve();
        }, 100);
    }));
};

/**
 * Fetch all unique inner (same domain) urls
 * within a targeted website.
 * @param data
 */
export const fetchUrls = async (data) => {
    try {

        console.log('Launching a new browser instance.');

        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });

        console.log('Opening a new page.');

        const page = await browser.newPage();

        console.log('Visiting url:', data.url);

        await page.goto(data.url, {waitUntil: 'domcontentloaded'});

        console.log('Getting all links from url:', data.url);

        const hrefs = await page.$$eval('a',
            as => as.map(a => a.href));

        console.log('Filtering unique inner links');

        const hrefInners = [...new Set(hrefs.filter(x => x.startsWith(data.url)))];

        if (!hrefInners.length) {
            console.info('No urls found. Exiting process.');

            await browser.close();
        }

        console.log('Creating a new crawl session for', hrefInners.length, 'urls');

        const crawlsRef = await db.websitesurl;
        let existedUrls;

        for (const el of hrefInners) {
            const dbUrls = await crawlsRef.findAll({
                where: {
                    url: el
                },
                attributes: ['url']
            });
            const stringUrls = JSON.stringify(dbUrls);
            existedUrls = JSON.parse(stringUrls);

            if (existedUrls[0]) {
                // console.log(existedUrls[0].url);
            } else {
                crawlsRef.create({
                    sourceUrl: data.url,
                    url: el
                });
            }
        }

        console.log('Setting urls for the crawl session.', data.url);

        // await batch.commit();

        console.log('Success: all set!', data.url);

        await browser.close();

        return existedUrls;
    } catch (e) {
        throw new Error(e.message)
    }
};

export const puppetize = async ({page, data}) => {
    try {
        let cookies = [];
        let requests = [];

        console.log('Visiting url:', data.url);

        console.log('Setting a Chrome DevTools Protocol session.', data.url);

        const devtools = await page.target().createCDPSession();

        console.log('Enabling CDP::Network');

        await devtools.send('Network.enable');

        await devtools.send('Network.setRequestInterception', {
            patterns: [{urlPattern: '*'}],
        });

        devtools.on('Network.requestIntercepted', async (event) => {
            requests = [...requests, {...event, requestId: event.requestId}];

            await devtools.send('Network.continueInterceptedRequest', {
                interceptionId: event.interceptionId,
            });
        });

        devtools.on('Network.responseReceivedExtraInfo', (response) => {
            if (response && response.headers &&
                response.headers['set-cookie']) {

                let parsedCookies = setCookie(response.headers['set-cookie']);

                parsedCookies = parsedCookies.map(cookie => {
                    return {
                        ...cookie,
                        requestId: response.requestId
                    }
                });

                cookies = [...cookies, ...parsedCookies];
            }
        });

        await page.goto(data.url, {waitUntil: 'domcontentloaded'});

        const cmpSelector = '#didomi-notice-agree-button';
        // const figaroCMP = "body > div > div > article > div > aside > section:nth-child(1) > button";
        if (cmpSelector) {
            console.log('CMP Detected', cmpSelector);

            await page.waitFor(3000);

            await page.click(cmpSelector);
        } else {
            console.log("No CMP Detected")
        }

        console.log('Scrolling to bottom...', data.url);

        await autoScroll(page);

        console.log('Pending...', data.url);

        await page.waitFor(3000);

        console.log('Getting requests for url:', data.url);

        const crawlsRequests = await db.requests;
        console.log(requests);
        for (let key of Object.keys(requests)) {
            crawlsRequests.create({
                interceptionId: requests[key].interceptionId,
                url: requests[key].request.url,
                pageUrl: data.url,
                initialPriority: requests[key].request.initialPriority,
                requestId: requests[key].requestId,
                // hostOs: os.hostname()
            });
        }

        console.log('Getting cookies for url:', data.url);

        const crawlsCookies = await db.cookies;
        console.log(cookies);
        for (let key of Object.keys(cookies)) {
            crawlsCookies.create({
                domain: cookies[key].domain,
                requestUrl: data.url,
                expires: cookies[key].expires,
                pageUrl: cookies[key].path,
                name: cookies[key].name,
                value: cookies[key].value,
                secure: cookies[key].secure,
                sameSite: cookies[key].sameSite,
                requestId: cookies[key].requestId,
                hostOs: os.hostname()
            });
        }
        // collect all cookies (not shared between pages)
        // Returns all browser cookies. Depending on the backend support, will return detailed cookie information in the cookies field.
        // Doc: https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-getAllCookies
        // const cookies = (await devtools.send('Network.getAllCookies')).cookies;

        // await db.requests.update({
        //     cookies: cookies,
        //     requests: requests,
        //     status: 'PROCESSED',
        //     workerId: os.hostname(),
        // });

        console.log('Success: all set!', data.url);

        await page.close();

        console.log('Page closed.');
    } catch (err) {
        throw new Error(err.message);
    }
};
