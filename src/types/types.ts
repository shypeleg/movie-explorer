import * as imdb from 'imdb-api';

export interface IVideo {
  fileName: string;
  filePath: string;
  searchableName: string;
  imdbId?: string;
  searchEngineImdbLink?: string;
  imdbData?: imdb.Movie;
  fileInfo?: {
    accessTime: Date;
    modifiedTime: Date;
    fileSizeMB: number;
  };
}
export interface ISearchEngineResult {
  engine: string;
  search: string;
  count: number;
  links: string[];
  error: boolean;
}

export const movieFileTypes = [
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
