export type MemoFolder = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MemoAttachment = {
  id: string;
  memoId: string;
  filePath: string;
  fileName: string | null;
  fileSize: number | null;
  createdBy: string;
  createdAt: string;
};

export type MemoItem = {
  id: string;
  title: string | null;
  content: string;
  folderId: string | null;
  isPinned: boolean;
  createdBy: string;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    displayName: string;
    username: string;
    profileColor: string;
  } | null;
};

export type MemoInput = {
  title?: string;
  content?: string;
  folderId?: string | null;
  isPinned?: boolean;
};
