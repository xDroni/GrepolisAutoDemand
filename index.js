const grepolis = require('./core');

(async () => {
    const browser = await grepolis.launchBrowser();
    const data = await grepolis.enterTheWorldAndGetData(browser, '', '', 1);
    grepolis.parseData(data);

})();