declare module "youtube-transcript" {
  export type TranscriptItem = {
    text: string;
    duration?: number;
    offset?: number;
  };

  export class YoutubeTranscript {
    static fetchTranscript(
      videoId: string,
      options?: {
        lang?: string;
        country?: string;
      }
    ): Promise<TranscriptItem[]>;
  }
}

