export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryWithChannelCount extends Category {
  channelCount: number;
}
