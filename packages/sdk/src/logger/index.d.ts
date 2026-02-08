import { type Logger } from 'winston';
export interface LoggerOptions {
    component: string;
    environment?: string;
    level?: string;
    enableConsole?: boolean;
    enableOtel?: boolean;
}
export declare const createSdkLogger: ({ component, environment, level, enableConsole, enableOtel }: LoggerOptions) => Logger;
//# sourceMappingURL=index.d.ts.map