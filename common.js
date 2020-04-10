const fs = require('fs');

/**
 * @param {Array} cookiesArray
 */
function cookiesArrayToString(cookiesArray) {
    let cookiesString = '';
    for(let cookie of cookiesArray) {
        cookiesString += cookie.name + '=' + cookie.value + '; ';
    }
    return cookiesString
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

module.exports = { cookiesArrayToString, saveToFile, getUsernamesFromFile: getUsernamesFromFile };