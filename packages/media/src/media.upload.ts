export const isMp3UploadFile = (file: Readonly<{ name: string; type: string }>): boolean =>
  file.type === 'audio/mpeg' ||
  file.type === 'audio/mp3' ||
  ((!file.type || file.type === 'application/octet-stream') && /\.mp3$/iu.test(file.name));
