import { random } from './random';
import { IPirateBayResult } from './types/pirates-types';
import PirateBay from 'thepiratebay';

import * as imdb from 'imdb-api';
import * as globby from 'globby';
import * as path from 'path';
import * as sec from 'search-engine-client';
import * as fs from 'fs';

const IMDB_API = '4fbdbb36';
const NUMBER_OF_PAGES_TO_SEARCH = 1;
const movieFileTypes = [
  'mpg2',
  'mov',
  'avi',
  'vob',
  'flc',
  'mpeg',
  'movie',
  'avs',
  'xvid',
  'webm',
  'mv',
  'ogg',
  'r3d',
  'dv',
  'mp4',
  'flv',
  'm2ts',
  'mts',
  'wmv',
  'mpg',
  'divx',
  'ogv',
  'mxf',
  'mkv',
  'm2t',
  'm4v',
  'ts',
  'm2v'
];

interface IFile {
  fileName: string;
  filePath: string;
  searchableName: string;
  imdbId?: string;
  searchEngineImdbLink?: string;
  imdbData?: imdb.Movie;
}
interface ISearchEngineResult {
  engine: string;
  search: string;
  count: number;
  links: string[];
  error: boolean;
}
// filename =>
async function run() {
  try {
    let files: IFile[];
    const movieFolder = '/Users/shyp/Documents/movies';

    // get files from folder:
    files = await movieFilesInFolder(movieFolder);

    files = await withIMDB(files);

    var json = JSON.stringify(files);
    console.log(`*****************************`)
    console.log(`Finished with ${files.length} movie files`);
    console.log(`*****************************`)
    await fs.writeFileSync('movie-data.json', json, 'utf8');

    // then save this as a db structure
  } catch (e) {
    console.log('exception: ', e);
  }
}

const withIMDB = async (inputFiles: IFile[]) => {
  try {
    const options = {
      count: 1,
      show: false,
      wait: random(50, 200)
    };
    const uniqueSearchableName = Array.from(new Set(inputFiles.map(f => f.searchableName)));

    // search bing for the imdb id for each movie name and get its imdb data:
    const withImdbResultsPromises = uniqueSearchableName.map(async movieName => {
      const bingAndImdbResult: ISearchEngineResult = await sec.bing(
        `site:imdb.com ${movieName}`,
        options
      );

      if (!bingAndImdbResult.error && bingAndImdbResult.count > 1) {
        const imdbId = extractImdbIdFromLink(bingAndImdbResult.links[1]);
        const imdbData = await imdb.getById(imdbId, {apiKey: IMDB_API, timeout: 15000});
        console.log(`the Imdb id for ${movieName} is: ${imdbId} `);
        return {
          movieName,
          imdbId,
          imdbLink: bingAndImdbResult.links[1],
          imdbData
        };
      }
    });
    const movieNameToImdbDataMap = (await Promise.all(withImdbResultsPromises)).reduce((map, obj) => {
      map[obj.movieName] = obj;
      return map;
    }, {});

    const files: IFile[] = inputFiles.map(f => {
      const searchEngineImdbLink = movieNameToImdbDataMap[f.searchableName].imdbLink;
      const imdbId = movieNameToImdbDataMap[f.searchableName].imdbId;
      const imdbData = movieNameToImdbDataMap[f.searchableName].imdbData;
      return { ...f, searchEngineImdbLink, imdbId, imdbData };
    });
    return files;
  } catch (e) {
    console.log('error while searching bing for the movies: ' + e);
  }
  return null;
};
const extractImdbIdFromLink = (imdbLink: string): string => {
  const regResult = new RegExp(/tt\d{7}/).exec(imdbLink);
  if (regResult[0] && regResult[0].length > 0) {
    return regResult[0];
  }
  return undefined;
};
const movieFilesInFolder = async (folderName: string): Promise<IFile[]> => {
  const paths: string[] = await globby(folderName, {
    expandDirectories: {
      extensions: movieFileTypes
    }
  });

  const files: IFile[] = paths.map(p => {
    const basefileName = path.basename(p);

    return {
      fileName: basefileName,
      filePath: p,
      searchableName: clearTorrentName(path.basename(p, path.extname(p)))
    };
  });
  return files;
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

  pirateBayResults.forEach(res => (res.name = clearTorrentName(res.name)));
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

// async function getFromIMDB(id: string): Promise<imdb.Movie> {
//   let res: imdb.Movie;
//   try {
//     res = await imdb.get({id: id}, { apiKey: IMDB_API, timeout: 30000 });
//     console.log('got movie info for imdbId: ', id);
//   } catch (exception) {
//     console.log('getFromIMDB:', exception);
//   }
//   return res;
// }
run();
