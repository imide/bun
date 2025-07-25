/// Compare `actual` and `expected`, producing a diff that would turn `actual`
/// into `expected`.
///
/// Lines in the returned diff have the same encoding as `actual` and
/// `expected`. Lines borrow from these inputs, but the diff list itself must
/// be deallocated.
///
/// Use an arena allocator, otherwise this will leak memory.
///
/// ## Invariants
/// If not met, this function will panic.
/// - `actual` and `expected` are alive and have the same encoding.
pub fn myersDiff(
    allocator: Allocator,
    global: *jsc.JSGlobalObject,
    actual: *const BunString,
    expected: *const BunString,
    // If true, strings that have a trailing comma but are otherwise equal are
    // considered equal.
    check_comma_disparity: bool,
    // split `actual` and `expected` into lines before diffing
    lines: bool,
) bun.JSError!jsc.JSValue {
    // Short circuit on empty strings. Note that, in release builds where
    // assertions are disabled, if `actual` and `expected` are both dead, this
    // branch will be hit since dead strings have a length of 0. This should be
    // moot since BunStrings with non-zero reference counds should never be
    // dead.
    if (actual.length() == 0 and expected.length() == 0) {
        return try jsc.JSValue.createEmptyArray(global, 0);
    }

    const actual_encoding = actual.encoding();
    const expected_encoding = expected.encoding();

    if (lines) {
        if (actual_encoding != expected_encoding) {
            const actual_utf8 = actual.toUTF8WithoutRef(allocator);
            defer actual_utf8.deinit();
            const expected_utf8 = expected.toUTF8WithoutRef(allocator);
            defer expected_utf8.deinit();

            return diffLines(u8, allocator, global, actual_utf8.byteSlice(), expected_utf8.byteSlice(), check_comma_disparity);
        }

        return switch (actual_encoding) {
            .latin1, .utf8 => diffLines(u8, allocator, global, actual.byteSlice(), expected.byteSlice(), check_comma_disparity),
            .utf16 => diffLines(u16, allocator, global, actual.utf16(), expected.utf16(), check_comma_disparity),
        };
    }

    if (actual_encoding != expected_encoding) {
        const actual_utf8 = actual.toUTF8WithoutRef(allocator);
        defer actual_utf8.deinit();
        const expected_utf8 = expected.toUTF8WithoutRef(allocator);
        defer expected_utf8.deinit();

        return diffChars(u8, allocator, global, actual.byteSlice(), expected.byteSlice());
    }

    return switch (actual_encoding) {
        .latin1, .utf8 => diffChars(u8, allocator, global, actual.byteSlice(), expected.byteSlice()),
        .utf16 => diffChars(u16, allocator, global, actual.utf16(), expected.utf16()),
    };
}

fn diffChars(
    comptime T: type,
    allocator: Allocator,
    global: *jsc.JSGlobalObject,
    actual: []const T,
    expected: []const T,
) bun.JSError!jsc.JSValue {
    const Differ = MyersDiff.Differ(T, .{ .check_comma_disparity = false });
    const diff: MyersDiff.DiffList(T) = Differ.diff(allocator, actual, expected) catch |err| return mapDiffError(global, err);
    return diffListToJS(T, global, diff);
}

fn diffLines(
    comptime T: type,
    allocator: Allocator,
    global: *jsc.JSGlobalObject,
    actual: []const T,
    expected: []const T,
    check_comma_disparity: bool,
) bun.JSError!jsc.JSValue {
    var a = try MyersDiff.split(T, allocator, actual);
    defer a.deinit(allocator);
    var e = try MyersDiff.split(T, allocator, expected);
    defer e.deinit(allocator);

    const diff: MyersDiff.DiffList([]const T) = blk: {
        if (check_comma_disparity) {
            const Differ = MyersDiff.Differ([]const T, .{ .check_comma_disparity = true });
            break :blk Differ.diff(allocator, a.items, e.items) catch |err| return mapDiffError(global, err);
        } else {
            const Differ = MyersDiff.Differ([]const T, .{ .check_comma_disparity = false });
            break :blk Differ.diff(allocator, a.items, e.items) catch |err| return mapDiffError(global, err);
        }
    };
    return diffListToJS([]const T, global, diff);
}

fn diffListToJS(comptime T: type, global: *jsc.JSGlobalObject, diff_list: MyersDiff.DiffList(T)) bun.JSError!jsc.JSValue {
    var array = try jsc.JSValue.createEmptyArray(global, diff_list.items.len);
    for (diff_list.items, 0..) |*line, i| {
        try array.putIndex(global, @truncate(i), (try jsc.JSObject.createNullProto(line.*, global)).toJS());
    }
    return array;
}

fn mapDiffError(global: *jsc.JSGlobalObject, err: MyersDiff.Error) bun.JSError {
    return switch (err) {
        error.OutOfMemory => error.OutOfMemory,
        error.DiffTooLarge => global.throwInvalidArguments("Diffing these two values would create a string that is too large. If this was intentional, please open a bug report on GitHub.", .{}),
        error.InputsTooLarge => global.throwInvalidArguments("Input strings are too large to diff. Please open a bug report on GitHub.", .{}),
    };
}

const MyersDiff = @import("./assert/myers_diff.zig");
const std = @import("std");
const Allocator = std.mem.Allocator;

const bun = @import("bun");
const BunString = bun.String;

const jsc = bun.jsc;
const JSValue = jsc.JSValue;
