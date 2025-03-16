declare module '@slack/web-api' {
  export class WebClient {
    constructor(token?: string, options?: any);
    
    // Chat methods
    chat: {
      postMessage: (options: {
        channel: string;
        text: string;
        blocks?: any[];
        attachments?: any[];
        thread_ts?: string;
        as_user?: boolean;
        [key: string]: any;
      }) => Promise<{
        ok: boolean;
        channel: string;
        ts: string;
        message: any;
        error?: string;
      }>;
      
      update: (options: {
        channel: string;
        ts: string;
        text?: string;
        blocks?: any[];
        attachments?: any[];
        [key: string]: any;
      }) => Promise<{
        ok: boolean;
        channel: string;
        ts: string;
        text: string;
        error?: string;
      }>;
    };
    
    // Users methods
    users: {
      info: (options: {
        user: string;
        [key: string]: any;
      }) => Promise<{
        ok: boolean;
        user: any;
        error?: string;
      }>;
      
      list: (options?: any) => Promise<{
        ok: boolean;
        members: any[];
        error?: string;
      }>;
    };
    
    // Channels methods
    conversations: {
      info: (options: {
        channel: string;
        [key: string]: any;
      }) => Promise<{
        ok: boolean;
        channel: any;
        error?: string;
      }>;
      
      list: (options?: any) => Promise<{
        ok: boolean;
        channels: any[];
        error?: string;
      }>;
    };
  }
}