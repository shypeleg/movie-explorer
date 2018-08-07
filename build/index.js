"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const thepiratebay_1 = require("thepiratebay");
const imdb = require("imdb-api");
const globby = require("globby");
const path = require("path");
const IMDB_API = '4fbdbb36';
const NUMBER_OF_PAGES_TO_SEARCH = 1;
const movieFileTypes = ['mpg2', 'mov', 'avi', 'vob', 'flc', 'mpeg', 'movie',
    'avs', 'xvid', 'webm', 'mv', 'ogg', 'r3d', 'dv', 'mp4',
    'flv', 'm2ts', 'mts', 'wmv', 'mpg', 'divx', 'ogv', 'mxf',
    'mkv', 'm2t', 'm4v', 'ts', 'm2v'];
function run() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            const movieFolder = '/Users/shyp/Documents/movies';
            const files = yield getFilesFromFolder(movieFolder);
            // get files from folder
            // search google and get imdbId
            // search imdb and get movie data
        }
        catch (e) {
            console.log('exception: ', e);
        }
    });
}
const getFilesFromFolder = (folderName) => tslib_1.__awaiter(this, void 0, void 0, function* () {
    const paths = yield globby(folderName, {
        expandDirectories: {
            extensions: movieFileTypes
        }
    });
    const fileNames = paths.map(x => clearTorrentName(path.basename(x, path.extname(x))));
    console.log('files', fileNames);
    return paths;
});
function getFromPirateBay() {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        let pirateBayResults = [];
        for (let i = 0; i < NUMBER_OF_PAGES_TO_SEARCH; ++i) {
            const pirateBayPageResults = yield thepiratebay_1.default.search('1080p 2017 -hc -korsub', {
                category: 'video',
                page: i,
                orderBy: 'seeds',
                sortBy: 'desc'
            });
            pirateBayResults = pirateBayResults.concat(...pirateBayPageResults);
            console.log('got page: ' + i + 1 + ' from piratebay');
        }
        pirateBayResults.forEach(res => res.name = clearTorrentName(res.name));
        return pirateBayResults;
    });
}
function clearTorrentName(name) {
    let newName = name;
    if (name.search('2017') > 0) {
        newName = name.substring(0, name.search('2017') + 4);
    }
    else if (name.search('2018') > 0) {
        newName = name.substring(0, name.search('2018') + 4);
    }
    // Remove everything after episode names if a series:
    const results = new RegExp(/(.*?)(?:s|season|EP)\d{2}/, 'i').exec(newName);
    if (results && results[1] && results[1].length > 0) {
        newName = results[1];
    }
    return newName.replace(/\./g, ' ').trim();
}
function getFromIMDB(name) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        let res;
        try {
            res = yield imdb.get(name, { apiKey: IMDB_API, timeout: 30000 });
        }
        catch (exception) {
            console.log('getFromIMDB:', exception);
        }
        return res;
    });
}
run();
//# sourceMappingURL=index.js.map