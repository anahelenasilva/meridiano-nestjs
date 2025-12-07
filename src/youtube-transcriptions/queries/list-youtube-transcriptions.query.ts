import { Injectable } from '@nestjs/common';
import moment from 'moment';
import { PaginatedYoutubeTranscriptionInput } from '../entities/youtube-transcription.entity';
import { YoutubeTranscriptionsService } from '../youtube-transcriptions.service';

export type ListYoutubeTranscriptionsRequest =
  PaginatedYoutubeTranscriptionInput;

export type ListYoutubeTranscriptionsResponse = {
  transcriptions: any[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_transcriptions: number;
  };
  filters: {
    sort_by: string;
    direction: string;
    channel_id: string;
    channel_name: string;
    search: string;
    start_date: string;
    end_date: string;
    preset: string;
  };
  available_channels: { id: string; name: string }[];
};

@Injectable()
export class ListYoutubeTranscriptionsQuery {
  constructor(private readonly service: YoutubeTranscriptionsService) { }

  async execute(
    request: ListYoutubeTranscriptionsRequest,
  ): Promise<ListYoutubeTranscriptionsResponse | null> {
    const {
      page = 1,
      perPage = 20,
      channel_id,
      channel_name,
      direction = 'desc',
      end_date,
      preset,
      search,
      sort_by = 'posted_at',
      start_date,
    } = request;

    let startDateToSearch = start_date;
    let endDateToSearch = end_date;

    if (preset) {
      const presetDates = this.parseDatePreset(preset);
      if (presetDates.startDate) {
        startDateToSearch = presetDates.startDate;
      }

      if (presetDates.endDate) {
        endDateToSearch = presetDates.endDate;
      }
    }

    const availableChannels = await this.service.getDistinctChannels();

    const totalTranscriptions = await this.service.countTotalTranscriptions({
      channel_id: channel_id,
      channel_name: channel_name,
      search: search,
      start_date: startDateToSearch,
      end_date: endDateToSearch,
    });

    const totalPages = Math.ceil(totalTranscriptions / perPage);

    const transcriptions = await this.service.getTranscriptionsPaginated({
      page,
      perPage,
      sort_by,
      direction,
      channel_id: channel_id,
      channel_name: channel_name,
      search: search,
      start_date: startDateToSearch,
      end_date: endDateToSearch,
    });

    return {
      transcriptions,
      pagination: {
        page,
        per_page: perPage,
        total_pages: totalPages,
        total_transcriptions: totalTranscriptions,
      },
      filters: {
        sort_by: sort_by,
        direction: direction,
        channel_id: channel_id ?? '',
        channel_name: channel_name ?? '',
        search: search ?? '',
        start_date: start_date ?? '',
        end_date: end_date ?? '',
        preset: preset ?? '',
      },
      available_channels: availableChannels,
    };
  }

  private parseDatePreset(preset: string): {
    startDate?: string;
    endDate?: string;
  } {
    const now = moment();

    switch (preset) {
      case 'yesterday': {
        const yesterday = now.clone().subtract(1, 'day');
        return {
          startDate: yesterday.format('YYYY-MM-DD'),
          endDate: yesterday.format('YYYY-MM-DD'),
        };
      }
      case 'last_week':
        return {
          startDate: now.clone().subtract(7, 'days').format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
        };
      case 'last_30d':
        return {
          startDate: now.clone().subtract(30, 'days').format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
        };
      case 'last_3m':
        return {
          startDate: now.clone().subtract(3, 'months').format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
        };
      case 'last_12m':
        return {
          startDate: now.clone().subtract(12, 'months').format('YYYY-MM-DD'),
          endDate: now.format('YYYY-MM-DD'),
        };
      default:
        return {};
    }
  }
}
