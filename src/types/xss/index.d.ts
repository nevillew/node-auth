declare module 'xss' {
  export interface IFilterXSSOptions {
    whiteList?: Record<string, string[]>;
    onTag?: (tag: string, html: string, options: any) => string | void;
    onTagAttr?: (tag: string, name: string, value: string, isWhiteAttr: boolean) => string | void;
    onIgnoreTag?: (tag: string, html: string, options: any) => string | void;
    onIgnoreTagAttr?: (tag: string, name: string, value: string, isWhiteAttr: boolean) => string | void;
    safeAttrValue?: (tag: string, name: string, value: string, cssFilter: any) => string;
    escapeHtml?: (html: string) => string;
    stripIgnoreTag?: boolean;
    stripIgnoreTagBody?: boolean | string[];
    allowCommentTag?: boolean;
    stripBlankChar?: boolean;
    css?: object;
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
    allowedStyles?: Record<string, (string | RegExp)[]>;
    allowedClasses?: Record<string, string[]>;
    allowedSchemes?: string[];
  }

  export interface IOptions extends IFilterXSSOptions {
    // Additional options
  }

  export default function xss(html: string, options?: IOptions): string;
}