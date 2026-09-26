import { deflateRawSync } from 'node:zlib';

type ZipEntry = {
  name: string;
  data: Buffer;
  isDirectory?: boolean;
};

type PreparedEntry = ZipEntry & {
  nameBytes: Buffer;
  compressedData: Buffer;
  crc32: number;
  offset: number;
};

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeDosTimestamp(header: Buffer, offset: number): void {
  header.writeUInt16LE(0, offset);
  header.writeUInt16LE(0x21, offset + 2);
}

/** Builds a UTF-8 ZIP archive with DEFLATE-compressed files. */
export function createZipArchive(entries: ZipEntry[]): Buffer {
  const prepared: PreparedEntry[] = [];
  const localParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = entry.isDirectory && !entry.name.endsWith('/') ? `${entry.name}/` : entry.name;
    const nameBytes = Buffer.from(name, 'utf8');
    const compressedData = entry.isDirectory ? Buffer.alloc(0) : deflateRawSync(entry.data);
    const checksum = crc32(entry.data);
    const localHeader = Buffer.alloc(30 + nameBytes.length);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(entry.isDirectory ? 0 : 8, 8);
    writeDosTimestamp(localHeader, 10);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBytes.copy(localHeader, 30);

    prepared.push({ ...entry, nameBytes, compressedData, crc32: checksum, offset });
    localParts.push(localHeader, compressedData);
    offset += localHeader.length + compressedData.length;
  }

  const centralParts = prepared.map((entry) => {
    const header = Buffer.alloc(46 + entry.nameBytes.length);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(entry.isDirectory ? 0 : 8, 10);
    writeDosTimestamp(header, 12);
    header.writeUInt32LE(entry.crc32, 16);
    header.writeUInt32LE(entry.compressedData.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(entry.nameBytes.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(entry.isDirectory ? 0x10 : 0, 38);
    header.writeUInt32LE(entry.offset, 42);
    entry.nameBytes.copy(header, 46);
    return header;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(prepared.length, 8);
  endRecord.writeUInt16LE(prepared.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}
