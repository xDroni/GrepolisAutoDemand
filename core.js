const puppeteer = require('puppeteer-core');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const FormData = require('form-data');

const {cookiesArrayToString, cookiesStringToArray, getRandomInt} = require('./common');

const grepolis = {
    launchBrowser: async (path = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe') => {
        console.log('Launching the browser in headless mode');
        return  puppeteer.launch({
            executablePath: path,
            // headless: false
        });
    },

    closeBrowser: async (browser) => {
        console.log('Closing browser');
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

    getGameData: async (cookie) => {
        const result = await fetch('https://pl86.grepolis.com/game/index', {
            headers: {
                cookie
            }
        })

        const text = await result.text()
        const regex = /(window\.Game = )(.*);/
        const gameDataString = text.match(regex)[2]
        return JSON.parse(gameDataString)
    },

    hasCaptain: (gameData) => {
        const captainEndTime = gameData.premium_features.captain;
        if(captainEndTime) {
            return captainEndTime > Math.floor(Date.now() / 1000)
        }
        return false;
    },

    hasAutoExtendCaptain: (gameData) => {
      return gameData.player_settings.extend_premium_captain;
    },

    enterTheWorldAndGetData: async (browser, login, password, worldNumber, cookies) => {
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
        if(!cookies) {
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
        }
        else {
            if(typeof cookies === 'string') cookies = cookiesStringToArray(cookies);
            await page.setCookie(...cookies);
            console.log('Cookies set');
            await page.goto('https://pl86.grepolis.com/game/index', {waitUntil: 'networkidle2'}); ///TODO hardcoded world id!!!
            await page.waitFor(2000);
        }

        const cookiesArr = await page.cookies();
        console.log(cookiesArrayToString(cookiesArr));
        console.log(page.url());

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
            cookies: cookiesArrayToString(cookiesArr),
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

                    for(const farmTown of farmTowns) {
                        const relation = farm_town_relations.find(farmTownRelation => {
                            return farmTownRelation.farm_town_id === farmTown.id
                        });
                        data[i].farmTowns.push({
                            farmTownRelation: relation.id,
                            farmTownId: relation.farm_town_id,
                            farmTownName: farmTown.name,
                            isBuilt: relation.relation_status === 1,
                            lootableAt: relation.lootable_at

                        });
                    }
                    i++
                } else {
                    data[i-1].towns.push({
                        townId: town.id,
                        townName: town.name,
                    });
                }
        }
        return data;
    },

    demand: (token, cookies, farmTown, town, waitTime) => {
        const waitTimeRandomized = (waitTime * 1000 + getRandomInt(-waitTime * 1000 / 2, waitTime * 1000 / 2));
        return new Promise((resolve, reject) => {
            console.log('Waiting', waitTimeRandomized / 1000, 'seconds before next demand');

            const data = {
                model_url: `FarmTownPlayerRelation/${farmTown.farmTownRelation}`,
                action_name: 'claim',
                arguments: {
                    farm_town_id: farmTown.farmTownId,
                    type: 'resources',
                    option: 1
                },
                town_id: town.townId,
                nl_init: true
            };

            let formData = new FormData();
            formData.append('json', JSON.stringify(data));

            setTimeout(() => {
                fetch(`https://pl86.grepolis.com/game/frontend_bridge?town_id=${town.townId}&action=execute&h=${token}`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Cookie': cookies
                    }
                }).catch(err => {
                    reject({ connectionError: err });
                    throw new Error(err);
                })
                    .then(res => res.json())
                    .then(response => {
                        const responseJson = response.json;
                        if (responseJson.success) {
                            resolve({townName: town.townName, farmTownName: farmTown.farmTownName})
                        } else {
                            reject(responseJson)
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        reject(err);
                    });
            }, waitTimeRandomized)
        })
    },

    fakeRequestsBeforeDemand: (token, cookies, farmTown, town, waitTime) => {
        const waitTimeRandomized = (waitTime * 1000 + getRandomInt(-waitTime * 1000 / 2, waitTime * 1000 / 2));
        return new Promise((resolve, reject) => {
            console.log('Waiting', waitTimeRandomized / 1000, 'seconds before faking request');
            const data = {
                model_url: `FarmTownPlayerRelation/${farmTown.farmTownRelation}`,
                action_name: 'getTownSpecificData',
                arguments: {
                    farm_town_id: farmTown.farmTownId
                },
                town_id: town.townId,
                nl_init: true
            };
            let formData = new FormData();

            formData.append('json', JSON.stringify(data));
            setTimeout(() => {
                fetch(`https://pl86.grepolis.com/game/frontend_bridge?town_id=${town.townId}&action=execute&h=${token}`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Cookie': cookies
                    }
                })
                    .catch(err => {
                        reject({connectionError: err});
                        throw new Error(err);
                    })
                    .then(res => res.json())
                    .then(response => {
                        const responseJson = response.json;
                        resolve(responseJson);
                    })
                    .catch(err => {
                        console.error(err);
                        reject(err);
                    });
            }, waitTimeRandomized)

        })
    },

    conquerorDemand: (token, cookies, farmTowns, town, waitTime) => {
        const waitTimeRandomized = (waitTime * 1000 + getRandomInt(-waitTime * 1000 / 2, waitTime * 1000 / 2));
        return new Promise((resolve, reject) => {
            console.log('Waiting', waitTimeRandomized / 1000, 'seconds before next demand');

            setTimeout(() => {
                const params = new URLSearchParams();
                const json = {
                    town_id: town.townId,
                    nl_init: true
                }
                params.append('town_id', town.townId);
                params.append('action', 'index');
                params.append('h', token);
                params.append('json', JSON.stringify(json));

                fetch(`https://pl86.grepolis.com/game/farm_town_overviews?${params}`, {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Cookie': cookies
                    }
                }).catch(err => {
                    reject({ connectionError: err });
                    throw new Error(err);
                })
                    .then(res => res.json())
                    .then(response => {
                        const responseJson = response.json;
                        if (responseJson.towns) {
                            resolve({ towns: responseJson.towns })
                        } else {
                            reject(responseJson)
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        reject(err);
                    });
            }, waitTimeRandomized)
        })
    },

    waitForIslandChange: (waitTime) => {
        const waitTimeRandomized = (waitTime*1000 + getRandomInt(-waitTime*1000 / 2, waitTime*1000 / 2));
        return new Promise((resolve) => {
            console.log('Waiting', waitTimeRandomized/1000, 'seconds for island to change');
            setTimeout(() => resolve(), waitTimeRandomized);
        })
    },

    waitForNextDemand: (waitTime) => {
        const waitTimeRandomized = (waitTime*1000 + getRandomInt(14*1000, 137*1000));
        return new Promise((resolve) => {
            console.log('Waiting', waitTimeRandomized/1000, 'seconds until demands get available again');
            setTimeout(() => resolve(), waitTimeRandomized);
        })
    }
};

module.exports = grepolis;