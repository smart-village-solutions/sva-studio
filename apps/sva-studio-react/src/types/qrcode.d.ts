declare module 'qrcode' {
  export type QRCodeRenderersOptions = Readonly<{
    type?: string;
    margin?: number;
    width?: number;
    color?: Readonly<{
      dark?: string;
      light?: string;
    }>;
  }>;

  export function toString(text: string, options?: QRCodeRenderersOptions): Promise<string>;
  export function toDataURL(text: string, options?: QRCodeRenderersOptions): Promise<string>;
}
