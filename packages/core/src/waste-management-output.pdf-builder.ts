export class PdfBuilder {
  private readonly objects = new Map<number, string>();
  private nextObjectId = 1;

  reserveObject(): number {
    const objectId = this.nextObjectId;
    this.nextObjectId += 1;
    return objectId;
  }

  setReservedObject(objectId: number, content: string): void {
    this.objects.set(objectId, content);
  }

  addObject(content: string): number {
    const objectId = this.reserveObject();
    this.setReservedObject(objectId, content);
    return objectId;
  }

  addStreamObject(streamContent: string): number {
    return this.addObject(`<< /Length ${Buffer.byteLength(streamContent, 'latin1')} >>\nstream\n${streamContent}\nendstream`);
  }

  build(rootObjectId: number): Buffer {
    const orderedIds = [...this.objects.keys()].sort((left, right) => left - right);
    let output = '%PDF-1.4\n';
    const offsets = new Map<number, number>();

    for (const objectId of orderedIds) {
      offsets.set(objectId, Buffer.byteLength(output, 'latin1'));
      output += `${objectId} 0 obj\n${this.objects.get(objectId) ?? ''}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(output, 'latin1');
    output += `xref\n0 ${this.nextObjectId}\n0000000000 65535 f \n`;
    for (let objectId = 1; objectId < this.nextObjectId; objectId += 1) {
      const offset = offsets.get(objectId);
      output +=
        offset === undefined
          ? '0000000000 65535 f \n'
          : `${offset.toString().padStart(10, '0')} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${this.nextObjectId} /Root ${rootObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(output, 'latin1');
  }
}
