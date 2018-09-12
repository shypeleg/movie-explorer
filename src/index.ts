import { random } from './random';

import * as imdb from 'imdb-api';
import * as globby from 'globby';
import * as path from 'path';
import * as sec from 'search-engine-client';
import * as fs from 'fs';
import { ISearchEngineResult, IVideo, movieFileTypes } from './types/types';
const IMDB_API = '4fbdbb36';
import Semaphore from 'semaphore-async-await';
import * as watch from 'node-watch';

// A Semaphore with one permit is a lock
const lock = new Semaphore(10);

async function run() {
  try {
    let files: IVideo[];
    let previousDB: IVideo[];
    console.log('running on folder: ', process.env.FOLDER);
    const movieFolder = process.env.FOLDER;
    const DB_FILE_NAME = 'movie-data.json';

    if (fs.existsSync(DB_FILE_NAME)) {
      previousDB = JSON.parse(fs.readFileSync(DB_FILE_NAME, 'utf8'));
  }
    // get files from folder:
    files = await movieFilesInFolder(movieFolder);

    console.log(`Found ${files.length} video files!`);
    files = await withIMDB(files, previousDB);

    console.log(`*****************************`);
    console.log(`Finished with ${files.length} video files`);
    console.log(`*****************************`);
    // then save this as a db structure
    await fs.writeFileSync(DB_FILE_NAME, JSON.stringify(files));

    watch(process.env.FOLDER, { recursive: true }, function(evt, name) {
      console.log('%s changed.', name);
      console.log('evt', evt);
    });
  } catch (e) {
    console.log('exception: ', e);
  }
}
const movieFilesInFolder = async (folderName: string, minSizeMB = 200): Promise<IVideo[]> => {
  const paths: string[] = await globby(folderName, {
    expandDirectories: {
      extensions: movieFileTypes
    }
  });

  const files: IVideo[] = paths.map(filePath => {
    const basefileName = path.basename(filePath);
    const fileInfo = fs.statSync(filePath);
    const searchableName = clearTorrentName(path.basename(filePath, path.extname(filePath)));
    //console.log(`${path.basename(filePath, path.extname(filePath))} --->>> : ${searchableName}`);
    //console.log(`${searchableName}`);
    return {
      fileName: basefileName,
      filePath: filePath,
      searchableName,
      fileInfo: {
        accessTime: fileInfo.atime,
        modifiedTime: fileInfo.mtime,
        fileSizeMB: fileInfo.size / 1024 / 1024
      }
    };
  });
  return files.filter(file => file.fileInfo.fileSizeMB > minSizeMB);
};

const withIMDB = async (inputFiles: IVideo[], previousDB: IVideo[]) => {
  try {

    let count = 0;
    const uniqueSearchableName = Array.from(new Set(inputFiles.map(f => f.searchableName)));

    // search bing for the imdb id for each movie name (or get from current db) and get its imdb data:
    const withImdbResultsPromises = uniqueSearchableName.map(async videoName => {
      let vid = {
        videoName,
        imdbId: null,
        imdbLink: null,
        imdbData: null
      };
      await lock.acquire();
      ++count;

      try {
        let imdbId = getImdbIdFromPreviousDb(videoName, previousDB) || await getImdbIdFromSearchEngine(videoName);

        if (imdbId) {
          vid.imdbId = imdbId;
          const imdbData = await imdb.getById(imdbId, { apiKey: IMDB_API, timeout: 15000 });
          vid = {
              videoName,
              imdbId,
              imdbLink: imdbData.imdburl,
              imdbData
            };
        } else {
            console.log(`imdb api found nothing for imdb id: ${imdbId} for video: ${videoName}`);
        }
      } catch (error) {
        console.log('errrrrorrr', error);
      } finally {
        lock.release();
      }
      console.log('% done: ', (count / uniqueSearchableName.length) * 100);
      return vid;
    });
    const withImdb = await Promise.all(withImdbResultsPromises);
    console.log('done searching!, found:', withImdb.length);

    const movieNameToImdbDataMap = withImdb.reduce((map, vid) => {
      if (vid) {
        map[vid.videoName] = vid;
      }
      return map;
    }, {});

    const files: IVideo[] = inputFiles.map(f => {
      if (movieNameToImdbDataMap[f.searchableName] && movieNameToImdbDataMap[f.searchableName].imdbLink) {
        const searchEngineImdbLink = movieNameToImdbDataMap[f.searchableName].imdbLink;
        const imdbId = movieNameToImdbDataMap[f.searchableName].imdbId;
        const imdbData = movieNameToImdbDataMap[f.searchableName].imdbData;
        return { ...f, searchEngineImdbLink, imdbId, imdbData };
      }
    });
    return files;
  } catch (e) {
    console.log('unexpected error while searching search engines and imdb: ' + e);
  }
  return null;
};

const getImdbIdFromSearchEngine = async (videoName): Promise<string> => {
  const options = {
    count: 1,
    show: false,
    debug: true,
    wait: random(50, 150)
  };
  let searchResults: ISearchEngineResult;
  let result: string;
  const searchTerm = `site:imdb.com/title ${videoName}`;
  searchResults = await sec.google(
    searchTerm,
      options
    );
  result = extractLink(searchResults);
  if (result) {
    return extractImdbIdFromLink(result);
  }
  searchResults = await sec.duckduckgo(
    searchTerm,
      options
    );
  result = extractLink(searchResults);
  if (result) {
    return extractImdbIdFromLink(result);
  }
  searchResults = await sec.bing(
    searchTerm,
      options
    );
  result = extractLink(searchResults);
  if (result) {
    return extractImdbIdFromLink(result);
  }
  console.log('search engines failed for: ', videoName);

  return null;
};

const extractLink = (searchResults: ISearchEngineResult): string => {
  if (!searchResults.error && searchResults.count > 0
    && searchResults.links && searchResults.links.length > 0)  {
      return searchResults.links[0];
    }
  return null;
};
const getImdbIdFromPreviousDb = (videoName, previousDB: IVideo[]): string => {
  if (previousDB) {
    const foundVid = previousDB.find(vid => vid && vid.searchableName === videoName);
    if (foundVid) {
      return foundVid.imdbId;
    }
  }
  return null;
};
const extractImdbIdFromLink = (imdbLink: string): string => {
  const regResult = new RegExp(/tt\d{7}/).exec(imdbLink);
  if (regResult && regResult[0] && regResult[0].length > 0) {
    return regResult[0];
  }
  console.log('imdb regex failed for:', imdbLink);
  return undefined;
};

function clearTorrentName(name: string): string {
  let newName = name;

  const yearRegex = new RegExp(/(^|\s|\.|\()(?:19|20)\d{2}($|\s|\.|\))/, 'i').exec(newName);

  if (yearRegex && yearRegex.index > 0) {
    newName = newName.substring(0, yearRegex.index + 5);
  }
  const formatRegex = new RegExp(/(^|.)(?:720p|1080p|MP4|aac|x264|brrip|MPEG4|HDTV|bluray)/).exec(newName);
  if (formatRegex && formatRegex.index > 0) {
    newName = newName.substring(0, formatRegex.index);
  }
  // try to capture season and episode
  // current - (.*?)(?:s|season|EP|\dx)(\d{2})|(E\d{2})

  const results = new RegExp(/(.*?)(?:s|season|EP|(\d)x)((\d{2})(E\d{2})|(\d{2}))/, 'i').exec(newName);
  if (results && results[1] && results[1].length > 0) {
    //console.log('results', results);
    // console.log('0', results[0]);
    // console.log('1', results[1]);
    // console.log('2', results[2]);
    // console.log('3', results[3]);
    // console.log('4', results[4]);

    newName = results[1];
  }
  return newName.replace(/\./g, ' ').trim();
}

run();
