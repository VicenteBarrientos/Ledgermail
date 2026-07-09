export declare function getOAuth2Client(): import("googleapis-common").OAuth2Client;
export declare function getAuthUrl(state?: string): string;
export interface GmailTokenResponse {
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: number | null;
}
export declare function getTokensFromCode(code: string): Promise<GmailTokenResponse>;
export declare function refreshAccessToken(refreshToken: string): Promise<string>;
export interface FetchedEmail {
    messageId: string;
    subject: string;
    from: string;
    receivedAt: Date;
    bodyHtml: string;
    hasAttachments: boolean;
}
export declare function syncGmailMessages(mailboxSourceId: string, maxResults?: number): Promise<FetchedEmail[]>;
