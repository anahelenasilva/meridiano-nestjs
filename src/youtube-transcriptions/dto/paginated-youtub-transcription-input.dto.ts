export interface PaginatedYoutubeTranscriptionInput {
  page?: number;
  perPage?: number;
  sort_by?: string;
  direction?: 'asc' | 'desc';
  channel_id?: string;
  channel_name?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  preset?: string;
}
