import { random } from './random';

import * as imdb from 'imdb-api';
import * as globby from 'globby';
import * as path from 'path';
import * as sec from 'search-engine-client';
import * as fs from 'fs';
import { ISearchEngineResult, IVideo, movieFileTypes } from './types/types';
const IMDB_API = '4fbdbb36';
import Semaphore from 'semaphore-async-await';
// A Semaphore with one permit is a lock
const lock = new Semaphore(10);

async function run() {
  try {
    let files: IVideo[];
    console.log('running on folder: ', process.env.FOLDER);
    const movieFolder = process.env.FOLDER;

    // get files from folder:
    files = await movieFilesInFolder(movieFolder);
    console.log(`Found ${files.length} video files!`);
    files = await withIMDB(files);

    console.log(`*****************************`);
    console.log(`Finished with ${files.length} video files`);
    console.log(`*****************************`);
    // then save this as a db structure
    await fs.writeFileSync('movie-data.json', JSON.stringify(files));
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

    return {
      fileName: basefileName,
      filePath: filePath,
      searchableName: clearTorrentName(path.basename(filePath, path.extname(filePath))),
      fileInfo: {
        accessTime: fileInfo.atime,
        modifiedTime: fileInfo.mtime,
        fileSizeMB: fileInfo.size / 1024 / 1024
      }
    };
  });
  return files.filter(file => file.fileInfo.fileSizeMB > minSizeMB);
};

const withIMDB = async (inputFiles: IVideo[]) => {
  try {
    const options = {
      count: 1,
      show: false,
      debug: true,
      wait: random(50, 150)
    };
    let count = 0;
    const uniqueSearchableName = Array.from(new Set(inputFiles.map(f => f.searchableName)));

    // search bing for the imdb id for each movie name and get its imdb data:
    const withImdbResultsPromises = uniqueSearchableName.map(async movieName => {
      let vid;
      await lock.acquire();
      ++count;

      try {
        const bingAndImdbResult: ISearchEngineResult = await sec.bing(
          `site:imdb.com ${movieName}`,
          options
        );

        if (!bingAndImdbResult.error && bingAndImdbResult.count > 0) {
          console.log('found ', movieName);
          const imdbId = extractImdbIdFromLink(bingAndImdbResult.links[1]);
          if (imdbId) {
            const imdbData = await imdb.getById(imdbId, { apiKey: IMDB_API, timeout: 15000 });
            vid = {
              movieName,
              imdbId,
              imdbLink: bingAndImdbResult.links[1],
              imdbData
            };
          }
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
        map[vid.movieName] = vid;
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
    console.log('error while searching bing for the movies: ' + e);
  }
  return null;
};
const extractImdbIdFromLink = (imdbLink: string): string => {
  const regResult = new RegExp(/tt\d{7}/).exec(imdbLink);
  if (regResult && regResult[0] && regResult[0].length > 0) {
    return regResult[0];
  } else {
    console.log('no imdb link for:', imdbLink);
  }
  return undefined;
};

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

run();
