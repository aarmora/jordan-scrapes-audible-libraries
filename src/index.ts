import puppeteer, { Browser } from 'puppeteer';
import { getPropertyBySelector } from 'puppeteer-helpers';
import { credentials } from './credentials';

interface IBook {
    imageUrl: string;
    title: string;
    url: string;
    author: string;
    asin: string;
    owner: string;
};

(async () => {
    try {
        let browser: Browser;
        const ubuntu = false;
        const headless = false;
        const runTwoFactor = true;
        if (ubuntu) {
            browser = await puppeteer.launch({ headless: true, args: [`--window-size=${1800},${1200}`, '--no-sandbox', '--disable-setuid-sandbox'] });
        }
        else {
            browser = await puppeteer.launch({ headless: headless, args: [`--window-size=${1800},${1200}`] });
        }
        const books: IBook[] = [];

        for (let i = 0; i < credentials.length; i++) {
            try {
                if (credentials[i].twoFactor && !runTwoFactor) {
                    continue;
                }
                const url = 'http://www.audible.com';
                const page = await browser.newPage();
                await page.goto(url);
                await page.click('.ui-it-sign-in-link');
                await page.waitFor(1500);

                await page.type('#ap_email', credentials[i].email);
                await page.type('#ap_password', credentials[i].pass);

                await page.click('#signInSubmit');

                if (credentials[i].twoFactor && runTwoFactor) {
                    try {
                        await page.waitForSelector('img.ui-it-header-logo', { timeout: 30000 })
                    }
                    catch (e) {
                        console.log('timed out waiting for 2fa');
                        await page.close();
                        continue;
                    }
                }

                await page.waitFor(1500);
                let libraryHasBooks = true;
                let pageNumber = 1;
                while (libraryHasBooks) {
                    await page.goto(`${url}/lib?purchaseDateFilter=all&programFilter=all&sortBy=PURCHASE_DATE.dsc&pageSize=50&page=${pageNumber}`);
                    const libraryEmptyHandle = await page.$('.bc-text img[src*="empty_lib_emoji"]');
                    if (libraryEmptyHandle) {
                        libraryHasBooks = false;
                    }
                    else {
                        const contentRows = await page.$$('tr[id^="adbl-library-content-row-"]');
                        for (let content of contentRows) {
                            const book: IBook = {
                                imageUrl: '',
                                title: '',
                                url: '',
                                author: '',
                                asin: '',
                                owner: credentials[i].owner
                            };
                            book.imageUrl = await getPropertyBySelector(content, '.bc-pub-block.bc-lazy-load.bc-image-inset-border', 'src');
                            book.title = await getPropertyBySelector(content, '.bc-list-item a[href^="/pd/"].bc-link.bc-color-link', 'innerHTML');
                            if (book.title) {
                                book.title = book.title.replace('\n', '').trim();
                            }
                            book.url = await getPropertyBySelector(content, 'a[href^="/pd/"]', 'href');
                            if (book.url) {
                                book.asin = book.url.split('/')[5].split('?')[0];
                            }
                            book.author = await getPropertyBySelector(content, 'a[href^="/author/"].bc-link.bc-color-link', 'innerHTML');
                            console.log('book', book);

                            if (book.title) {
                                books.push(book);
                            }
                        }

                        pageNumber++;
                    }

                }
                await page.goto(`${url}/signout`);
                await page.close();

            }
            catch (err) {
                console.log('error in original search', err);
            }
        }
        console.log('books', books.length);
    }
    catch (e) {
        console.log('error in set up', e);
    }
    process.exit();

})();