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

        console.log(cookies.length);

        for( let key of Object.keys(cookies)) {
            const crawlsRef = await db.cookies.create({
                domain: cookies[key].domain,
                pageUrl: cookies[key].path,
                value: cookies[key].value,
                name: cookies[key].name,
                hostOs: os.hostname()
            });
        }


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
    console.log('Visiting url:', data.url);

    await page.goto(data.url, {waitUntil: 'domcontentloaded'});

    // // [CMP] Accept ALL
    await page.click(
        '#didomi-notice-agree-button',
    );

    console.log('Setting a Chrome DevTools Protocol session.');

    const client = await page.target().createCDPSession();

    await client.send('Network.enable');

    console.log('Pending...');

    await page.waitFor(5000);

    console.log('Getting cookies for url:', data.url);

    const cookies = (await client.send('Network.getAllCookies')).cookies;

    if (!cookies.length) {
        console.log('No cookies for', data.url);
    } else {
        console.log('Nb cookies:', cookies.length )
    }

    // await db.doc(doc.dbPath).update({
    //   cookies: cookies,
    //   status: 'PROCESSED',
    //   workerId: os.hostname(),
    // });

    console.log('Success: all set!');
};
