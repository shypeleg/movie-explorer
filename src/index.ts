import { random } from './random';

import * as imdb from 'imdb-api';
import * as globby from 'globby';
import * as path from 'path';
import * as sec from 'search-engine-client';
import * as fs from 'fs';
import { ISearchEngineResult, IVideo, movieFileTypes } from './types/types';
const IMDB_API = '4fbdbb36';

async function run() {
  try {
    let files: IVideo[];
    const movieFolder = '/Users/shyp/Documents/movies';

    // get files from folder:
    files = await movieFilesInFolder(movieFolder);

    files = await withIMDB(files);

//    const json = JSON.stringify(files);
    console.log(`*****************************`);
    console.log(`Finished with ${files.length} video files`);
    console.log(`*****************************`);
    // then save this as a db structure
    await fs.writeFileSync('movie-data.json', JSON.stringify(files));

  } catch (e) {
    console.log('exception: ', e);
  }
}

const withIMDB = async (inputFiles: IVideo[]) => {
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

    const files: IVideo[] = inputFiles.map(f => {
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
const movieFilesInFolder = async (folderName: string): Promise<IVideo[]> => {
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
      }
    };
  });
  return files;
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
