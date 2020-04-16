const grepolis = require('./core');
const { getArgument, shuffleTheArray } = require('./common');

(async () => {
    const sid = `sid=${getArgument('sid')}`;
    const login = getArgument('login');
    const password = getArgument('password');
    let count = getArgument('count');

    if(!(login && password) && !sid) {
        console.error('You need to provide sid or both login and password as parameters');
        process.exit(-1);
    }

    if(!count) {
        console.log('Count parameter not found, setting default to 10 (10 demands for each farm town)');
        count = 10;
    } else {
        console.log('count:', count)
    }

    const browser = await grepolis.launchBrowser();
    const data = await grepolis.enterTheWorldAndGetData(browser, login, password, 1, sid);
    let token = data.token;
    let cookiesDemand = data.cookies;
    let parsedData = grepolis.parseData(data);

    for(let i=0; i<count; i++) {
        parsedData = shuffleTheArray(parsedData);
        for(const [index, item] of parsedData.entries()) { // [ {islandId: id, towns: [], farmTowns: []}, ... ]
            console.log('\nWyspa', item.islandId);
            const farmTowns = shuffleTheArray(item.farmTowns);
            const towns = shuffleTheArray(item.towns);
            for(const farmTown of farmTowns) {
                if(farmTown.isBuilt) {
                    await grepolis.fakeRequestsBeforeDemand(token, cookiesDemand, farmTown, towns[0], 6)
                        .catch(err => {
                            if(err.connectionError) {
                                console.error('error', err);
                            } else {
                                console.error('error', err);
                                process.exit(-1);
                            }
                        });
                    await grepolis.demand(token, cookiesDemand, farmTown, towns[0], 2)
                        .then(res => {
                            console.log('\nZażądano surowców do miasta', res.townName, 'z wioski', res.farmTownName);
                        })
                        .catch(err => {
                            if(err.connectionError) {
                                console.error('error', err);
                            } else {
                                console.error('error', err);
                                process.exit(-1);
                            }
                        });
                }
            }
            if(index+1 !== parsedData.length) {
                await grepolis.waitForIslandChange(7);
                console.log('Zmieniono wyspę');
            }
        }
        if(i+1 !== Number.parseInt(count)) {
            await grepolis.waitForNextDemand(600); // 10 minutes
        }
    }

    await grepolis.closeBrowser(browser);


})();