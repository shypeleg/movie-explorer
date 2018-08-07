import { IPirateBayResult } from './types/pirates-types';
import PirateBay from 'thepiratebay';
import * as imdb from 'imdb-api';
import * as globby from 'globby';
import * as path from 'path';

const IMDB_API = '4fbdbb36';
const NUMBER_OF_PAGES_TO_SEARCH = 1;
const movieFileTypes = ['mpg2', 'mov', 'avi', 'vob', 'flc', 'mpeg', 'movie',
'avs', 'xvid', 'webm', 'mv', 'ogg', 'r3d', 'dv', 'mp4',
'flv', 'm2ts', 'mts', 'wmv', 'mpg', 'divx', 'ogv', 'mxf',
'mkv', 'm2t', 'm4v', 'ts', 'm2v'];

async function run() {
    try {
        const movieFolder = '/Users/shyp/Documents/movies';
        const files = await getFilesFromFolder(movieFolder);
        // get files from folder
        // search google and get imdbId
        // search imdb and get movie data

    } catch (e) {
        console.log('exception: ', e);
    }
}

const getFilesFromFolder = async (folderName: string) => {

    const paths: string[] = await globby(folderName, {
    expandDirectories: {
        extensions: movieFileTypes
    }
});
    const fileNames = paths.map(x => clearTorrentName(path.basename(x, path.extname(x))));
    console.log('files', fileNames);
    return paths;
};

async function getFromPirateBay(): Promise<IPirateBayResult[]> {
    let pirateBayResults: IPirateBayResult[] = [];
    for (let i = 0; i < NUMBER_OF_PAGES_TO_SEARCH; ++i) {
        const pirateBayPageResults: IPirateBayResult[] = await PirateBay.search('1080p 2017 -hc -korsub', {
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
}
function clearTorrentName(name: string): string {
    let newName = name;
    if (name.search('2017') > 0) {
        newName = name.substring(0, name.search('2017') + 4);
    } else if (name.search('2018') > 0) {
        newName = name.substring(0, name.search('2018') + 4);
    }
    // Remove everything after episode names if a series:
    const results = new RegExp(/(.*?)(?:s|season|EP)\d{2}/, 'i').exec(newName);
    if (results && results[1] && results[1].length > 0) {
        newName = results[1];
    }
    return newName.replace(/\./g, ' ').trim();
}

async function getFromIMDB(name: string): Promise<imdb.Movie> {
    let res: imdb.Movie;
    try {
        res = await imdb.get(name, { apiKey: IMDB_API, timeout: 30000 });
    } catch (exception) {
        console.log('getFromIMDB:', exception);
    }
    return res;
}
run();
