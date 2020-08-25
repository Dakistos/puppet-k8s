import * as os from 'os';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const db = require('../../models');

const autoScroll = async (page) => {
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 30);
        });
    });
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

        console.log('Getting cookies for url:', data.url);

        const cookies = (await page._client.send('Network.getAllCookies')).cookies;

        const crawlsRef = await db.cookies;

        for( let key of Object.keys(cookies)) {
            crawlsRef.create({
                domain: cookies[key].domain,
                pageUrl: cookies[key].path,
                requestUrl: data.url,
                value: cookies[key].value,
                name: cookies[key].name,
                hostOs: os.hostname()
            });
        }

        console.log(cookies)
        console.log('Nb cookies for', data.url, ":", cookies.length);

        // const batch = db.batch();

        // hrefInners.forEach(link => {
        //   const urlRef = crawlsRef.collection('urls').doc();
        //
        //   batch.set(urlRef, {
        //     url: link,
        //     status: 'PENDING',
        //   });
        // });

        console.log('Setting urls for the crawl session.', data.url);

        // await batch.commit();

        console.log('Success: all set!', data.url);

        await browser.close();

        return `crawls/${crawlsRef.id}/urls`;
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

        if (data.cmpSelector) {
            console.log('CMP Detected', data.cmpSelector);

            await page.waitFor(3000);

            await page.click(data.cmpSelector);
        }

        console.log('Scrolling to bottom...', data.url);

        await autoScroll(page);

        console.log('Pending...', data.url);

        await page.waitFor(3000);

        console.log('Getting cookies for url:', data.url);

        // collect all cookies (not shared between pages)
        // Returns all browser cookies. Depending on the backend support, will return detailed cookie information in the cookies field.
        // Doc: https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-getAllCookies
        // const cookies = (await devtools.send('Network.getAllCookies')).cookies;

        await db.requests.update({
            cookies: cookies,
            requests: requests,
            status: 'PROCESSED',
            workerId: os.hostname(),
        });

        console.log('Success: all set!', data.url);

        await page.close();

        console.log('Page closed.');
    } catch (err) {
        throw new Error(err.message);
    }
};
// export const puppetize = async ({page, data}) => {
//     let cookies = [];
//     let requests = [];
//
//     console.log('Visiting url:', data.url);
//
//     await page.goto(data.url, {waitUntil: 'domcontentloaded'});
//
//     console.log('Setting a Chrome DevTools Protocol session.');
//
//     const client = await page.target().createCDPSession();
//
//     await client.send('Network.enable');
//
//     console.log('Pending...');
//
//     await page.waitFor(5000);
//
//     console.log('Getting cookies for url:', data.url);
//
//     const cookies = (await client.send('Network.getAllCookies')).cookies;
//
//     if (!cookies.length) {
//         console.log('No cookies for', data.url);
//     } else {
//         console.log('Nb cookies:', cookies.length )
//     }
//
//     // await db.doc(doc.dbPath).update({
//     //   cookies: cookies,
//     //   status: 'PROCESSED',
//     //   workerId: os.hostname(),
//     // });
//
//     console.log('Success: all set!');
// };
