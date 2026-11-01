export type Song = {
  title: string;
  date: string;
  md: string;
  album: string;
  spotify: string;
  exact_link: boolean;
};

export type DB = {
  generated_at: string;
  songs: Song[];
  days: Record<string, number[]>;
};

export type Match = { md: string; distance: number; songs: Song[] };

export type Result =
  | { kind: 'exact'; md: string; songs: Song[] }
  | { kind: 'nearest'; md: string; before?: Match; after?: Match };
