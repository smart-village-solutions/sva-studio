export class PdfBuilder {
  private readonly objects = new Map<number, Buffer>();
  private nextObjectId = 1;

  reserveObject(): number {
    const objectId = this.nextObjectId;
    this.nextObjectId += 1;
    return objectId;
  }

  setReservedObject(objectId: number, content: string | Buffer): void {
    this.objects.set(objectId, typeof content === 'string' ? Buffer.from(content, 'latin1') : content);
  }

  addObject(content: string | Buffer): number {
    const objectId = this.reserveObject();
    this.setReservedObject(objectId, content);
    return objectId;
  }

  addStreamObject(streamContent: string | Buffer, dictionary = ''): number {
    const streamBuffer = typeof streamContent === 'string' ? Buffer.from(streamContent, 'latin1') : streamContent;
    const dictionaryPrefix = dictionary.length > 0 ? `${dictionary} ` : '';
    return this.addObject(
      Buffer.concat([
        Buffer.from(`<< ${dictionaryPrefix}/Length ${streamBuffer.length} >>\nstream\n`, 'latin1'),
        streamBuffer,
        Buffer.from('\nendstream', 'latin1'),
      ])
    );
  }

  build(rootObjectId: number): Buffer {
    const orderedIds = [...this.objects.keys()].sort((left, right) => left - right);
    const offsets = new Map<number, number>();
    const outputParts: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
    let outputLength = outputParts[0].length;

    for (const objectId of orderedIds) {
      const objectContent = this.objects.get(objectId) ?? Buffer.alloc(0);
      offsets.set(objectId, outputLength);
      const objectPrefix = Buffer.from(`${objectId} 0 obj\n`, 'latin1');
      const objectSuffix = Buffer.from('\nendobj\n', 'latin1');
      outputParts.push(objectPrefix, objectContent, objectSuffix);
      outputLength += objectPrefix.length + objectContent.length + objectSuffix.length;
    }

    const xrefOffset = outputLength;
    let xref = `xref\n0 ${this.nextObjectId}\n0000000000 65535 f \n`;
    for (let objectId = 1; objectId < this.nextObjectId; objectId += 1) {
      const offset = offsets.get(objectId);
      xref +=
        offset === undefined
          ? '0000000000 65535 f \n'
          : `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${this.nextObjectId} /Root ${rootObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    outputParts.push(Buffer.from(xref, 'latin1'), Buffer.from(trailer, 'latin1'));
    return Buffer.concat(outputParts);
  }
}
