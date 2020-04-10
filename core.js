const puppeteer = require('puppeteer-core');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');

const {cookiesArrayToString} = require('./common');

const grepolis = {
    launchBrowser: async (path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe') => {
        console.log('Launching the browser in headless mode');
        return  puppeteer.launch({
            executablePath: path,
            headless: false
        });
    },

    closeBrowser: async (browser) => {
        await browser.close();
    },

    refreshCookies: async (browser) => {
        const page = await browser.newPage();
        console.log('Refreshing token');
        await page.goto(`https://pl.grepolis.com/`);
        const cookiesArr = await page.cookies();
        // console.log(cookiesArr);
        const tokenObj = cookiesArr.find(cookie => cookie.name === 'XSRF-TOKEN');
        const token = tokenObj.value;
        return {
            cookie: cookiesArrayToString(cookiesArr),
            token
        };
    },

    getData: async () => {
        const playersURL = `http://pl86.grepolis.com/data/players.txt`;
        const alliancesURL = `http://pl86.grepolis.com/data/alliances.txt`;

        const playersFetch = await fetch(playersURL);
        const playersText = await playersFetch.text();
        const playersArray = playersText.split('\n');
        const playersData = playersArray.map(player => {
            const data = player.split(',');
            return {
                playerId: data[0],
                name: decodeURIComponent(data[1]).replace(/\+/g, ' '),
                allianceId: data[2],
                points: data[3],
                ranking: data[4],
                towns: data[5]
            }
        });

        const alliancesFetch = await fetch(alliancesURL);
        const alliancesText = await alliancesFetch.text();
        const alliancesArray = alliancesText.split('\n');
        const alliancesData = alliancesArray.map(alliance => {
            const data = alliance.split(',');
            return {
                allianceId: data[0],
                name: decodeURIComponent(data[1]).replace(/\+/g, ' '),
                points: data[2],
                towns: data[3],
                members: data[4],
                ranking: data[5]
            }
        });

        return {
            playersData,
            alliancesData
        }
    },

    getAllianceMembers: (allianceName, data) => {
        const { playersData, alliancesData } = data;
        const { allianceId } = alliancesData.find(alliance => alliance.name.toLowerCase() === allianceName.toLowerCase());
        return playersData.filter(player => player.allianceId === allianceId);
    },

    tryLogin: async (cookies, token, username, password) => {
        const params = new URLSearchParams();
        params.append('login[userid]', username);
        params.append('login[password]', password);

        return fetch('https://pl.grepolis.com/glps/login_check', {
            method: 'POST',
            body: params,
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Cookie': cookies,
                'x-xsrf-token': token
            }
        });
    },

    enterTheWorldAndGetData: async (browser, login, password, worldNumber) => {
         let cookies = null;
        // let cookies = [
        //     {
        //         name: 'ig_conv_last_site',
        //         value: 'https://pl86.grepolis.com/game/index',
        //         domain: '.grepolis.com',
        //         path: '/',
        //         expires: 1617925081,
        //         size: 53,
        //         httpOnly: false,
        //         secure: false,
        //         session: false
        //     },
        //     {
        //         name: 'toid',
        //         value: '24756',
        //         domain: 'pl86.grepolis.com',
        //         path: '/',
        //         expires: 1588981080.323397,
        //         size: 9,
        //         httpOnly: false,
        //         secure: false,
        //         session: false
        //     },
        //     {
        //         name: 'logged_in',
        //         value: 'false',
        //         domain: 'pl86.grepolis.com',
        //         path: '/',
        //         expires: -1,
        //         size: 14,
        //         httpOnly: false,
        //         secure: false,
        //         session: true
        //     },
        //     {
        //         name: 'sid',
        //         value: 'ks84go4wwo448cs8wgwcc44ggo4s08sog4kcw84wwgc0kkcswcs4wcwosokcgwcs',
        //         domain: 'pl86.grepolis.com',
        //         path: '/',
        //         expires: 1617925079.990739,
        //         size: 67,
        //         httpOnly: true,
        //         secure: true,
        //         session: false
        //     },
        //     {
        //         name: 'cid',
        //         value: '1931213242',
        //         domain: 'pl86.grepolis.com',
        //         path: '/',
        //         expires: 1649461079.990713,
        //         size: 13,
        //         httpOnly: false,
        //         secure: false,
        //         session: false
        //     },
        //     {
        //         name: 'metricsUvId',
        //         value: '6c6f76ac-2bad-4f0a-b5a9-935ca019aa86',
        //         domain: '.grepolis.com',
        //         path: '/',
        //         expires: 4742062674,
        //         size: 47,
        //         httpOnly: false,
        //         secure: false,
        //         session: false
        //     }
        // ]

        const page = await browser.newPage();
        await page.setRequestInterception(true);

        page.on('request', async request => {
            if(['image', 'stylesheet', 'font'].indexOf(request.resourceType()) !== -1) {
                request.abort();
            } else {
                request.continue()
            }
        });

        await page.goto('https://pl.grepolis.com/', {waitUntil: 'networkidle2'});
        if(cookies === null) {
            /* Logging in */
            let loginError;
            let secondAttempt = false;
            do {
                if (secondAttempt) {
                    login = prompt('Login: ');
                    password = prompt('Password: ');
                }

                const loginInput = (await page.waitFor('input[id="login_userid"]')).asElement();
                await page.evaluate(element => element.value = '', loginInput);
                await loginInput.type(login);

                const passwordInput = await page.$('input[id="login_password"]');
                await page.evaluate(element => element.value = '', passwordInput);
                await passwordInput.type(password);

                await page.keyboard.press('Enter');
                console.log('Logging in...');

                await page.waitForNavigation();

                loginError = await page.$('.validation-message-error > span');
                if (loginError !== null) {
                    const text = await page.evaluate(element => element.textContent, loginError);
                    console.error('Login error');
                    console.error(text);
                    if (!secondAttempt) {
                        secondAttempt = true;
                    }
                }
            } while (loginError !== null);

            /* Selecting the world */
            await page.waitFor('a[class="logout_button"]');
            console.log('Logged in successfully');
            const worlds = await page.$$('div[id="worlds"] > div > ul > li');
            for (let i = 0; i < worlds.length - 1; i++) {
                const text = await page.evaluate(element => element.textContent, worlds[i]);
                console.log(i + 1, text);
            }

            let choice = worldNumber;
            while (!(choice >= 1 && choice <= worlds.length - 1)) {
                choice = prompt(`Choose the world [1-${worlds.length - 1}]: `);
            }
            console.log('Your choice: ' + choice);

            /* Logging in into world */
            await worlds[choice - 1].click();
            console.log('Loading the world...');

            await page.waitForNavigation();
            const cookiesArr = await page.cookies();
            console.log(cookiesArr);
            console.log(cookiesArrayToString(cookiesArr));
        }
        else {
            await page.setCookie(...cookies);
            await page.goto('https://pl87.grepolis.com/game/index', {waitUntil: 'load'});
            await page.waitFor(2000);
        }

        const data = await page.evaluate(() => {
            let farm_town_data = MM.getOnlyCollectionByName('FarmTown');
            let town_collection = MM.getOnlyCollectionByName('Town');
            let farm_town_relations = MM.getOnlyCollectionByName('FarmTownPlayerRelation');
            let csrfToken = Game.csrfToken;
            console.log(farm_town_data, town_collection);
            return {
                token: csrfToken,
                farm_town_data: JSON.stringify(farm_town_data),
                town_collection: JSON.stringify(town_collection),
                farm_town_relations: JSON.stringify(farm_town_relations)
            }
        });

        return {
            token: data.token,
            farm_town_data: JSON.parse(data.farm_town_data), // wszystkie wioski
            town_collection: JSON.parse(data.town_collection), // wszystkie miasta gracza
            farm_town_relations: JSON.parse(data.farm_town_relations) // wszystkie relacje wioska miasto
        };
    },

    parseData: (_data) => {
        const {farm_town_data, town_collection, farm_town_relations} = _data;

        let data = [];
            let i = 0;
            for (let town of town_collection) {
                if(!data.some(item => item.islandId === town.island_id)) {
                    data.push({
                        islandId: town.island_id,
                        towns: [
                            {
                                townId: town.id,
                                townName: town.name,
                            }
                        ],
                        farmTowns: []
                    });

                    let farmTowns = farm_town_data.filter(farmTown => {
                        return farmTown.island_x === town.island_x && farmTown.island_y === town.island_y
                    });

                    farmTowns = farmTowns.filter(farmTown => {
                        const relation = farm_town_relations.find(farmTownRelation => {
                            return farmTownRelation.farm_town_id === farmTown.id
                        });
                        data[i].farmTowns.push({
                            farmTownRelation: relation.id,
                            farmTownId: relation.farm_town_id,
                            isBuilt: relation.relation_status === 1

                        });
                    });
                    i++
                } else {
                    data[i-1].towns.push({
                        townId: town.id,
                        townName: town.name,
                    });
                }
        }
        console.log(JSON.stringify(data, null,2));
        return data;

        // let data = [];
        // for (const [index, relation] of farm_town_relations.entries()) {
        //     const farmTown = farm_town_data.find(farmTown => {
        //         return farmTown.id === relation.farm_town_id
        //     });
        //
        //     data.push({
        //         farmTownId: farmTown.id,
        //         farmTownName: farmTown.name,
        //         farmTownRelationId: relation.id,
        //         isBuilt: relation.relation_status === 1,
        //         towns: []
        //     });
        //
        //     const towns = town_collection.filter(town => {
        //         return town.island_x === farmTown.island_x && town.island_y === farmTown.island_y
        //     });
        //
        //     for(const town of towns) {
        //         data[index].towns.push({
        //             townId: town.id,
        //             townName: town.name
        //         })
        //     }
        // }
        // console.log(JSON.stringify(data, null,2));


        //     let data = [];
    //     for (const [index, town] of town_collection.entries()) {
    //         data.push({
    //             townId: town.id,
    //             townName: town.name,
    //             islandId: town.island_id,
    //             farmTowns: []
    //         });
    //
    //         let farmTowns = farm_town_data.filter(farmTown => {
    //             return farmTown.island_x === town.island_x && farmTown.island_y === town.island_y
    //         });
    //
    //         farmTowns = farmTowns.filter(farmTown => {
    //             const relation = farm_town_relations.find(farmTownRelation => {
    //                 return farmTownRelation.farm_town_id === farmTown.id
    //             });
    //             data[index].farmTowns.push({
    //                 farmTownRelation: relation.id,
    //                 farmTownId: relation.farm_town_id,
    //                 isBuilt: relation.relation_status === 1
    //
    //             });
    //         });
    //     }
    //     console.log(JSON.stringify(data, null,2));
    }
};

module.exports = grepolis;