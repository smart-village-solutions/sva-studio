import { mediaScanLimits } from '@sva/media';
import { fileTypeFromBuffer } from 'file-type';

import { MediaStorageSizeLimitError, type MediaStoragePort } from './storage-port.js';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const mp3FileType = { ext: 'mp3', mime: 'audio/mpeg' } as const;
const mpeg1Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const lowSampleRateBitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const baseSampleRates = [44100, 48000, 32000];

const mp3FrameSize = (body: Uint8Array, offset: number): number => {
  if (offset + 4 > body.length) return 0;
  const sync = body[offset];
  const versionAndLayer = body[offset + 1] ?? 0;
  if (sync !== 0xff || (versionAndLayer & 0xe6) !== 0xe2) return 0;

  const version = (versionAndLayer >> 3) & 3;
  if (version === 1) return 0;
  const bitrateAndSampleRate = body[offset + 2] ?? 0;
  const bitrateIndex = bitrateAndSampleRate >> 4;
  const bitrate = (version === 3 ? mpeg1Bitrates : lowSampleRateBitrates)[bitrateIndex];
  const sampleRate = baseSampleRates[(bitrateAndSampleRate >> 2) & 3];
  if (!bitrate || !sampleRate) return 0;

  const sampleRateDivisor = version === 3 ? 1 : version === 2 ? 2 : 4;
  const coefficient = version === 3 ? 144000 : 72000;
  return (
    Math.floor((coefficient * bitrate * sampleRateDivisor) / sampleRate) +
    ((bitrateAndSampleRate >> 1) & 1)
  );
};

const hasMp3AudioFrames = (body: Uint8Array): boolean => {
  let offset = 0;
  if (body[0] === 0x49 && body[1] === 0x44 && body[2] === 0x33) {
    if (body.length < 10 || body.subarray(6, 10).some((byte) => byte > 0x7f)) return false;
    const tagSize = body.subarray(6, 10).reduce((size, byte) => (size << 7) | byte, 0);
    const footerSize = body[3] === 4 && ((body[5] ?? 0) & 0x10) !== 0 ? 10 : 0;
    offset = 10 + tagSize + footerSize;
  }

  // An ID3 tag or a single sync header can match without containing audio.
  const firstFrameSize = mp3FrameSize(body, offset);
  if (!firstFrameSize) return false;
  const nextFrame = offset + firstFrameSize;
  const secondFrameSize = mp3FrameSize(body, nextFrame);
  return secondFrameSize > 0 && nextFrame + secondFrameSize <= body.length;
};

export const readOriginalUpload = async (input: {
  storage: Pick<MediaStoragePort, 'readObject'>;
  instanceId: string;
  upload: { storageKey: string; byteSize: number };
  mimeType: string;
  audio: boolean;
  quarantined: boolean;
}) => {
  if (input.audio && !input.quarantined) throw new Error('invalid_media_content');
  const declaredSize = Number(input.upload.byteSize);
  const sizeLimit = input.audio ? Math.min(declaredSize, mediaScanLimits.maxBytes) : declaredSize;
  const object = await input.storage.readObject({
    instanceId: input.instanceId,
    storageKey: input.upload.storageKey,
    ...(input.audio ? { maxBytes: sizeLimit } : {}),
  });
  if (object.byteSize > sizeLimit || (input.audio && object.body.byteLength > sizeLimit))
    throw new MediaStorageSizeLimitError();

  const detected = input.audio ? mp3FileType : await fileTypeFromBuffer(object.body);
  const mimeType = detected?.mime ?? object.contentType ?? input.mimeType;
  const validFormat = input.audio
    ? hasMp3AudioFrames(object.body) &&
      (object.contentType === undefined || object.contentType === mp3FileType.mime)
    : imageMimeTypes.has(mimeType);
  if (mimeType !== input.mimeType || !validFormat) throw new Error('invalid_media_content');

  return { ...object, mimeType, extension: detected?.ext ?? 'bin' };
};
