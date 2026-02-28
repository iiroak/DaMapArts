/**
 * NBT (Named Binary Tag) writer and reader for Minecraft data.
 *
 * Faithfully ports the original mapartcraft nbt.jsworker NBTWriter / NBTReader
 * with TypeScript types and modern APIs.
 *
 * Reference: https://minecraft.wiki/w/NBT_format#TAG_definition
 */

// ── Tag type constants ──
export const TagTypes = {
  end: 0,
  byte: 1,
  short: 2,
  int: 3,
  long: 4,
  float: 5,
  double: 6,
  byteArray: 7,
  string: 8,
  list: 9,
  compound: 10,
  intArray: 11,
  longArray: 12,
} as const;

export type TagType = (typeof TagTypes)[keyof typeof TagTypes];

// ── NBT value types ──
export interface NBTList {
  type: TagType;
  value: NBTValue[];
}

export interface NBTCompound {
  [key: string]: { type: TagType; value: NBTValue };
}

export type NBTValue =
  | number
  | [number, number] // long as two int32s
  | string
  | Uint8Array // byteArray
  | number[] // intArray / longArray items
  | [number, number][] // longArray
  | NBTList
  | NBTCompound;

export interface NBTTopLevel {
  name: string;
  value: NBTCompound;
}

// ── NBT Writer ──

export class NBTWriter {
  private buffer: ArrayBuffer;
  private dataView: DataView;
  private arrayView: Uint8Array;
  private offset: number;

  constructor(initialSize = 1024) {
    this.buffer = new ArrayBuffer(initialSize);
    this.dataView = new DataView(this.buffer);
    this.arrayView = new Uint8Array(this.buffer);
    this.offset = 0;
  }

  private encodeUTF8(str: string): number[] {
    const array: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      if (c === 0x0) {
        array.push(0xc0, 0x80);
      } else if (c < 0x80) {
        array.push(c);
      } else if (c < 0x800) {
        array.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0x10000) {
        array.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        array.push(
          0xf0 | ((c >> 18) & 0x07),
          0x80 | ((c >> 12) & 0x3f),
          0x80 | ((c >> 6) & 0x3f),
          0x80 | (c & 0x3f),
        );
      }
    }
    return array;
  }

  private accommodate(size: number): void {
    const requiredLength = this.offset + size;
    if (this.buffer.byteLength >= requiredLength) return;

    let newLength = this.buffer.byteLength;
    while (newLength < requiredLength) newLength *= 2;

    const newBuffer = new ArrayBuffer(newLength);
    const newArrayView = new Uint8Array(newBuffer);
    newArrayView.set(this.arrayView);

    if (this.offset > this.buffer.byteLength) {
      newArrayView.fill(0, this.buffer.byteLength, this.offset);
    }

    this.buffer = newBuffer;
    this.dataView = new DataView(newBuffer);
    this.arrayView = newArrayView;
  }

  private write(dataType: string, size: number, value: number): void {
    this.accommodate(size);
    (this.dataView as any)[`set${dataType}`](this.offset, value);
    this.offset += size;
  }

  writeByType(dataType: number, value: any): void {
    switch (dataType) {
      case TagTypes.end:
        this.writeByType(TagTypes.byte, 0);
        break;

      case TagTypes.byte:
        this.write('Int8', 1, value);
        break;

      case TagTypes.short:
        this.write('Int16', 2, value);
        break;

      case TagTypes.int:
        this.write('Int32', 4, value);
        break;

      case TagTypes.long:
        // Long as two int32 halves [hi, lo]
        this.write('Int32', 4, value[0]);
        this.write('Int32', 4, value[1]);
        break;

      case TagTypes.float:
        this.write('Float32', 4, value);
        break;

      case TagTypes.double:
        this.write('Float64', 8, value);
        break;

      case TagTypes.byteArray:
        this.writeByType(TagTypes.int, value.length);
        this.accommodate(value.length);
        this.arrayView.set(value, this.offset);
        this.offset += value.length;
        break;

      case TagTypes.string: {
        const bytes = this.encodeUTF8(value);
        this.writeByType(TagTypes.short, bytes.length);
        this.accommodate(bytes.length);
        this.arrayView.set(bytes, this.offset);
        this.offset += bytes.length;
        break;
      }

      case TagTypes.list:
        this.writeByType(TagTypes.byte, value.type);
        this.writeByType(TagTypes.int, value.value.length);
        for (let i = 0; i < value.value.length; i++) {
          this.writeByType(value.type, value.value[i]);
        }
        break;

      case TagTypes.compound:
        for (const key of Object.keys(value)) {
          this.writeByType(TagTypes.byte, value[key].type);
          this.writeByType(TagTypes.string, key);
          this.writeByType(value[key].type, value[key].value);
        }
        this.writeByType(TagTypes.end, 0);
        break;

      case TagTypes.intArray:
        this.writeByType(TagTypes.int, value.length);
        for (let i = 0; i < value.length; i++) {
          this.writeByType(TagTypes.int, value[i]);
        }
        break;

      case TagTypes.longArray:
        this.writeByType(TagTypes.int, value.length);
        for (let i = 0; i < value.length; i++) {
          this.writeByType(TagTypes.long, value[i]);
        }
        break;

      default:
        throw new Error(`Unknown data type ${dataType} for value ${value}`);
    }
  }

  writeTopLevelCompound(value: NBTTopLevel): void {
    this.writeByType(TagTypes.byte, TagTypes.compound);
    this.writeByType(TagTypes.string, value.name);
    this.writeByType(TagTypes.compound, value.value);
  }

  getData(): ArrayBuffer {
    this.accommodate(0);
    return this.buffer.slice(0, this.offset);
  }
}

// ── NBT Reader ──

export class NBTReader {
  private buffer: ArrayBuffer | null = null;
  private dataView: DataView | null = null;
  private arrayView: Uint8Array | null = null;
  private offset = 0;

  loadBuffer(buffer: ArrayBuffer): void {
    this.buffer = buffer;
    this.dataView = new DataView(buffer);
    this.arrayView = new Uint8Array(buffer);
    this.offset = 0;
  }

  private decodeUTF8(bytes: Uint8Array): string {
    const codepoints: number[] = [];
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if ((byte & 0x80) === 0) {
        codepoints.push(byte);
      } else if ((byte & 0xe0) === 0xc0) {
        codepoints.push(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
        i += 1;
      } else if ((byte & 0xf0) === 0xe0) {
        codepoints.push(((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
        i += 2;
      }
    }
    return String.fromCharCode(...codepoints);
  }

  private read(dataType: string, size: number): number {
    const value = (this.dataView as any)[`get${dataType}`](this.offset);
    this.offset += size;
    return value;
  }

  readByType(dataType: number): any {
    switch (dataType) {
      case TagTypes.end:
        return this.readByType(TagTypes.byte);

      case TagTypes.byte:
        return this.read('Int8', 1);

      case TagTypes.short:
        return this.read('Int16', 2);

      case TagTypes.int:
        return this.read('Int32', 4);

      case TagTypes.long:
        return [this.readByType(TagTypes.int), this.readByType(TagTypes.int)];

      case TagTypes.float:
        return this.read('Float32', 4);

      case TagTypes.double:
        return this.read('Float64', 8);

      case TagTypes.byteArray: {
        const arrayLength = this.readByType(TagTypes.int);
        const returnArray = this.arrayView!.slice(this.offset, this.offset + arrayLength);
        this.offset += arrayLength;
        return returnArray;
      }

      case TagTypes.string: {
        const length = this.readByType(TagTypes.short);
        const bytes = this.arrayView!.slice(this.offset, this.offset + length);
        this.offset += length;
        return this.decodeUTF8(bytes);
      }

      case TagTypes.list: {
        const listType = this.readByType(TagTypes.byte);
        const listLength = this.readByType(TagTypes.int);
        const result: { type: number; value: any[] } = { type: listType, value: [] };
        for (let i = 0; i < listLength; i++) {
          result.value.push(this.readByType(listType));
        }
        return result;
      }

      case TagTypes.compound: {
        const result: Record<string, { type: number; value: any }> = {};
        while (true) {
          const tagType = this.readByType(TagTypes.byte);
          if (tagType === TagTypes.end) break;
          const key = this.readByType(TagTypes.string);
          const value = this.readByType(tagType);
          result[key] = { type: tagType, value };
        }
        return result;
      }

      case TagTypes.intArray: {
        const length = this.readByType(TagTypes.int);
        const arr: number[] = [];
        for (let i = 0; i < length; i++) arr.push(this.readByType(TagTypes.int));
        return arr;
      }

      case TagTypes.longArray: {
        const length = this.readByType(TagTypes.int);
        const arr: [number, number][] = [];
        for (let i = 0; i < length; i++) arr.push(this.readByType(TagTypes.long));
        return arr;
      }

      default:
        throw new Error(`Unknown data type ${dataType}`);
    }
  }

  getData(): NBTTopLevel {
    this.readByType(TagTypes.byte); // compound tag type
    return {
      name: this.readByType(TagTypes.string),
      value: this.readByType(TagTypes.compound),
    };
  }
}
