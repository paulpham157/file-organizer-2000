// Mock openai as an object with tools and responses methods
export const openai = Object.assign(
  jest.fn((model: string, options: any) => ({
    generateText: jest.fn().mockImplementation(async ({ prompt }) => ({
      text: "Mocked response",
      experimental_providerMetadata: {
        openai: {
          annotations: [
            {
              type: "url_citation",
              url_citation: {
                url: "https://example.com",
                title: "Example Page Title",
                start_index: 0,
                end_index: 15
              }
            }
          ]
        }
      }
    }))
  })),
  {
    tools: {
      webSearchPreview: jest.fn((options: any) => ({
        type: 'web_search_preview',
        searchContextSize: options?.searchContextSize || 'low',
      })),
    },
    responses: jest.fn((model: string) => ({
      generateText: jest.fn(),
      streamText: jest.fn(),
    })),
  }
);

export type OpenAIProviderMetadata = {
  annotations?: Array<{
    type: string;
    url_citation?: {
      url: string;
      title: string;
      start_index: number;
      end_index: number;
    };
  }>;
};