const std = @import("std");

const hex = "0123456789ABCDEF";

fn isUnreserved(byte: u8) bool {
    return (byte >= 'a' and byte <= 'z') or
        (byte >= 'A' and byte <= 'Z') or
        (byte >= '0' and byte <= '9') or
        byte == '-' or
        byte == '.' or
        byte == '_' or
        byte == '~';
}

fn percentEncodedLen(input: []const u8) usize {
    var total: usize = 0;

    for (input) |byte| {
        total += if (isUnreserved(byte)) 1 else 3;
    }

    return total;
}

fn writePercentEncoded(input: []const u8, out: []u8) usize {
    var offset: usize = 0;

    for (input) |byte| {
        if (isUnreserved(byte)) {
            out[offset] = byte;
            offset += 1;
        } else {
            out[offset] = '%';
            out[offset + 1] = hex[(byte >> 4) & 0x0F];
            out[offset + 2] = hex[byte & 0x0F];
            offset += 3;
        }
    }

    return offset;
}

fn readU32LE(input: []const u8, offset: *usize) ?u32 {
    if (input.len - offset.* < 4) {
        return null;
    }

    const index = offset.*;
    const value: u32 = @as(u32, input[index]) |
        (@as(u32, input[index + 1]) << 8) |
        (@as(u32, input[index + 2]) << 16) |
        (@as(u32, input[index + 3]) << 24);
    offset.* += 4;
    return value;
}

fn readLengthPrefixedSlice(input: []const u8, offset: *usize) ?[]const u8 {
    const slice_len = readU32LE(input, offset) orelse return null;
    const len = @as(usize, slice_len);

    if (input.len - offset.* < len) {
        return null;
    }

    const slice = input[offset.* .. offset.* + len];
    offset.* += len;
    return slice;
}

fn serializedEntriesBinaryLen(input: []const u8) ?usize {
    var offset: usize = 0;
    const entry_count = readU32LE(input, &offset) orelse return null;
    var total: usize = 0;

    var index: u32 = 0;
    while (index < entry_count) : (index += 1) {
        const key = readLengthPrefixedSlice(input, &offset) orelse return null;
        const value = readLengthPrefixedSlice(input, &offset) orelse return null;

        if (index != 0) {
            total += 1;
        }

        total += percentEncodedLen(key);
        total += 1;
        total += percentEncodedLen(value);
    }

    if (offset != input.len) {
        return null;
    }

    return total;
}

fn writeSerializedEntriesBinary(input: []const u8, out: []u8) ?usize {
    var input_offset: usize = 0;
    const entry_count = readU32LE(input, &input_offset) orelse return null;
    var offset: usize = 0;

    var index: u32 = 0;
    while (index < entry_count) : (index += 1) {
        const key = readLengthPrefixedSlice(input, &input_offset) orelse return null;
        const value = readLengthPrefixedSlice(input, &input_offset) orelse return null;

        if (index != 0) {
            out[offset] = '&';
            offset += 1;
        }

        offset += writePercentEncoded(key, out[offset..]);
        out[offset] = '=';
        offset += 1;
        offset += writePercentEncoded(value, out[offset..]);
    }

    if (input_offset != input.len) {
        return null;
    }

    return offset;
}

pub export fn percent_encode_component_write(
    input_ptr: [*]const u8,
    len: usize,
    out_ptr: [*]u8,
    out_len: usize,
) usize {
    const input = input_ptr[0..len];
    const needed = percentEncodedLen(input);

    if (needed > out_len) {
        return needed;
    }

    return writePercentEncoded(input, out_ptr[0..needed]);
}

pub export fn serialize_entries_binary_write(
    input_ptr: [*]const u8,
    len: usize,
    out_ptr: [*]u8,
    out_len: usize,
) usize {
    const input = input_ptr[0..len];
    const needed = serializedEntriesBinaryLen(input) orelse return 0;

    if (needed > out_len) {
        return needed;
    }

    return writeSerializedEntriesBinary(input, out_ptr[0..needed]) orelse 0;
}
