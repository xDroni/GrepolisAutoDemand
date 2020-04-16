const fs = require('fs');

/**
 * @param {Array} cookiesArray
 * @returns {String} cookiesString
 */
function cookiesArrayToString(cookiesArray) {
    let cookiesString = '';
    for(let cookie of cookiesArray) {
        cookiesString += cookie.name + '=' + cookie.value + '; ';
    }
    return cookiesString
}

/**
 * @param {String} cookiesString
 * @returns {Array} cookiesArray
 */
function cookiesStringToArray(cookiesString) {
    let cookiesArray = [];
    const chunks = cookiesString.split('; ');
    for(const chunk of chunks) {
        let strings = chunk.split('=');
        if(strings[0] === 'sid') {
            cookiesArray.push({
                name: strings[0],
                value: strings[1],
                domain: 'pl86.grepolis.com'
            })
        } else {
            cookiesArray.push({
                name: strings[0],
                value: strings[1]
            })
        }
    }
    return cookiesArray;
}

function saveToFile(data) {
    return new Promise((resolve, reject) => {
        fs.readFile('data.json', (err, _data) => {
            if(_data) {
                let json = JSON.parse(_data);

                if(json.some(obj => obj.username === data.username && obj.password === data.password)) return;

                json.push({
                    username: data.username,
                    password: data.password
                });

                fs.writeFile('data.json', JSON.stringify(json, null, 2), (err) => {
                    if(err) {
                        reject('Failed saving to file')
                    } else {
                        resolve('Saved to file successfully')
                    }
                })
            }
            else {
                let json = [];

                json.push({
                    username: data.username,
                    password: data.password
                });

                fs.writeFile('data.json', JSON.stringify(json, null, 2), (err) => {
                    if(err) {
                        reject('Failed saving to file')
                    } else {
                        resolve('Saved to file successfully')
                    }
                })
            }
        })
    })
}
function getUsernamesFromFile() {
    return new Promise((resolve) => {
        fs.readFile('data.json', (err, data) => {
            if(data) {
                const json = JSON.parse(data);
                let result = [];
                for(const item of json) {
                    result.push(item.username);
                }
                resolve(result);
            }
            else {
                resolve([]);
            }
        })
    })
}
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** @param {string} str */
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 *  @param {string} name
 *  @returns {(string|null)}
 */
function getArgument(name) {
    for (let arg of process.argv) {
        let regexp = new RegExp(`^${escapeRegExp(name)}`);
        if( arg.match(regexp) )
            return arg.replace(regexp, '').substring(1);
    }

    return null;
}

/**
 *  @param {Array} array
 *  @returns {Array}
 */
function shuffleTheArray(array) {
    let m = array.length, t, i;
    while(m) {
        i = Math.floor(Math.random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
}

module.exports = {
    cookiesArrayToString,
    cookiesStringToArray,
    saveToFile,
    getUsernamesFromFile,
    getRandomInt,
    getArgument,
    shuffleTheArray
};