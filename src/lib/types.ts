export type RdUser = {
  id: number;
  username: string;
  email: string;
  points: number;
  locale: string;
  avatar: string;
  type: string;
  premium: number;
  expiration: string;
};

export type RdDownload = {
  id: string;
  filename: string;
  mimeType?: string;
  filesize: number;
  link: string;
  host: string;
  chunks: number;
  download: string;
  generated: string;
  type?: string;
};

export type RdTorrentFile = {
  id: number;
  path: string;
  bytes: number;
  selected: number;
};

export type RdTorrent = {
  id: string;
  filename: string;
  hash: string;
  bytes: number;
  original_bytes?: number;
  host: string;
  split: number;
  progress: number;
  status:
    | "magnet_error"
    | "magnet_conversion"
    | "waiting_files_selection"
    | "queued"
    | "downloading"
    | "downloaded"
    | "error"
    | "virus"
    | "compressing"
    | "uploading"
    | "dead"
    | string;
  added: string;
  links?: string[];
  ended?: string;
  speed?: number;
  seeders?: number;
  files?: RdTorrentFile[];
};

export type RdHostStatus = {
  id: string;
  name: string;
  image?: string;
  check?: string;
  status?: string;
  supported?: number;
};

export type UnrestrictResult = {
  id: string;
  filename: string;
  mimeType?: string;
  filesize: number;
  link: string;
  host: string;
  chunks: number;
  crc?: number;
  download: string;
  streamable?: number;
};
