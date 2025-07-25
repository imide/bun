pub fn generate(key: []const u8, data: []const u8, algorithm: bun.jsc.API.Bun.Crypto.EVP.Algorithm, out: *[boring.EVP_MAX_MD_SIZE]u8) ?[]const u8 {
    var outlen: c_uint = boring.EVP_MAX_MD_SIZE;
    if (boring.HMAC(
        algorithm.md() orelse bun.Output.panic("Expected BoringSSL algorithm for HMAC", .{}),
        key.ptr,
        key.len,
        data.ptr,
        data.len,
        out,
        &outlen,
    ) == null) {
        return null;
    }

    return out[0..outlen];
}

const bun = @import("bun");
const boring = bun.BoringSSL.c;
