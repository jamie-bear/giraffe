export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  items: PlaylistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  contentId: string;
  position: number;
  addedAt: string;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  isPublic: boolean;
  itemCount: number;
  createdAt: string;
}
