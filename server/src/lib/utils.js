import * as os from 'os';
import setCookie from 'set-cookie-parser';
import {launch} from "puppeteer";

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

const launchBrowser = async (browser) => {
    browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ],
    });
    return browser;
};

/**
 * Fetch all unique inner (same domain) urls
 * within a targeted website.
 * @param data
 */
export const fetchUrls = async (data) => {
    try {

        console.log('Launching a new browser instance.');

        const browser = await launchBrowser(browser);

        console.log('Opening a new page.');

        const page = await browser.newPage();

        console.log('Visiting url:', data.url);

        await page.goto(data.url, {waitUntil: 'domcontentloaded'});

        console.log('Getting all links from url:', data.url);

        const hrefs = await page.$$eval('a',
            as => as.map(a => a.href));

        console.log('Filtering unique inner links');

        const hrefInners = [
            ...new Set(hrefs.filter(x => x.startsWith(data.url))
            )].filter(value => !value.includes('#'));

        if (!hrefInners.length) {
            console.info('No urls found. Exiting process.');

            await browser.close();
        }

        console.log('Creating a new crawl session for', hrefInners.length, 'urls');
        let uniqueValues;

        const crawlsRef = await db.websitesurl;
        let existedUrls;

        // Search more urls
        for (let i = 0; i < 10; i++) {
            // Select random url in initial array
            let rand = hrefInners[Math.floor(Math.random() * hrefInners.length)];

            console.log("Crawling session for : ", rand);

            await page.goto(rand, {waitUntil: 'domcontentloaded'});
            const pages = await page.$$eval('a', as => as.map(a => a.href));

            // Filter unique links and delete urls with "#"
            const filteredPages = [...new Set(
                pages.filter(x => x.startsWith(data.url))
            )].filter(value => !value.includes('#'));

            // Push new Urls in initial array
            hrefInners.push.apply(hrefInners, filteredPages);
            uniqueValues = [...new Set(hrefInners)];

            console.log("Base Urls :", hrefInners.length);
            console.log("Unique Urls :", uniqueValues.length);
        }
        // console.log(uniqueValues);

        console.log('Setting urls for the crawl session.', data.url);

        // Check if Urls exist in DB or add them
        for (const el of uniqueValues) {
            const dbUrls = await crawlsRef.findAll({
                where: {
                    url: el
                },
                attributes: ['url']
            });
            const stringUrls = JSON.stringify(dbUrls);
            existedUrls = JSON.parse(stringUrls);

            if (!existedUrls[0]) {
                crawlsRef.create({
                    sourceUrl: data.url,
                    url: el
                });
            }
        }

        console.log('Success: all set!', data.url);

        await browser.close();
        // console.log(existedUrls);
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
        // const cmpSelector = '#cookieConsentAcceptButton';
        // const cmpSelector = "body > div > div > article > div > aside > section:nth-child(1) > button";
        if (cmpSelector) {
            console.log('CMP Detected', cmpSelector);

            await page.waitFor(3000);

            await page.click(cmpSelector);
        } else {
            console.log("No CMP Detected")
        }

        console.log('Scrolling to bottom...', data.url);

        await autoScroll(page);

        const all_browser_cookies = (await devtools.send('Network.getAllCookies')).cookies;
        console.log(all_browser_cookies, "///", all_browser_cookies.length);

        console.log('Pending...', data.url);

        await page.waitFor(3000);

        console.log('Getting requests for url:', data.url);

        const crawlsRequests = await db.requests;
        // console.log(requests);
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
        console.log("Requests detected :", requests.length);

        console.log('Getting cookies for url:', data.url);

        cookies.push.apply(cookies, all_browser_cookies);
        let allCookies = [...new Set(cookies.filter(cookieName => cookieName.name))];

        const crawlsCookies = await db.cookies;
        // console.log(cookies);
        for (let key of Object.keys(allCookies)) {
            crawlsCookies.create({
                domain:allCookies[key].domain,
                requestUrl: data.url,
                expires: allCookies[key].expires,
                pageUrl: allCookies[key].path,
                name: allCookies[key].name,
                value: allCookies[key].value,
                secure: allCookies[key].secure,
                sameSite: allCookies[key].sameSite,
                requestId: allCookies[key].requestId,
                hostOs: os.hostname()
            });
        }

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
