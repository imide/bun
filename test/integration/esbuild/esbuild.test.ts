import { spawn } from "bun";
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { cp, rm, writeFile } from "fs/promises";
import { bunExe, bunEnv as env, tmpdirSync } from "harness";
import { join } from "path";

beforeAll(() => {
  setDefaultTimeout(1000 * 60 * 5);
});

describe("esbuild integration test", () => {
  test("install and use esbuild", async () => {
    const packageDir = tmpdirSync();

    await writeFile(
      join(packageDir, "package.json"),
      JSON.stringify({
        name: "bun-esbuild-test",
        version: "1.0.0",
      }),
    );

    var { stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "install", "esbuild@0.19.8"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    });

    var err = await stderr.text();
    var out = await stdout.text();
    expect(err).toContain("Saved lockfile");
    expect(out).toContain("esbuild@0.19.8");
    expect(await exited).toBe(0);

    ({ stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "esbuild", "--version"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    }));

    err = await stderr.text();
    out = await stdout.text();
    expect(err).toBe("");
    expect(out).toContain("0.19.8");
    expect(await exited).toBe(0);
  });

  test("install and use estrella", async () => {
    const packageDir = tmpdirSync();

    await writeFile(
      join(packageDir, "package.json"),
      JSON.stringify({
        name: "bun-esbuild-estrella-test",
        version: "1.0.0",
      }),
    );

    var { stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "install", "estrella@1.4.1"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    });

    var err = await stderr.text();
    var out = await stdout.text();
    expect(err).toContain("Saved lockfile");
    expect(out).toContain("estrella@1.4.1");
    expect(await exited).toBe(0);

    ({ stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "estrella", "--estrella-version"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    }));

    err = await stderr.text();
    out = await stdout.text();
    expect(err).toBe("");
    expect(out).toContain("1.4.1");
    expect(await exited).toBe(0);

    await cp(join(import.meta.dir, "build-file.js"), join(packageDir, "build-file.js"));

    ({ stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "estrella", "build-file.js"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    }));

    err = await stderr.text();
    out = await stdout.text();
    expect(err).toBe("");
    expect(out).toBe('console.log("hello"),console.log("estrella");\n');
    expect(await exited).toBe(0);

    await rm(join(packageDir, "node_modules"), { recursive: true, force: true });
    await rm(join(packageDir, "bun.lockb"), { force: true });

    await writeFile(
      join(packageDir, "package.json"),
      JSON.stringify({
        name: "bun-esbuild-estrella-test",
        version: "1.0.0",
        dependencies: {
          "estrella": "1.4.1",
          // different version of esbuild
          "esbuild": "0.19.8",
        },
      }),
    );

    ({ stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "install"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    }));

    err = await stderr.text();
    out = await stdout.text();
    expect(err).toContain("Saved lockfile");
    expect(out).toContain("estrella@1.4.1");
    expect(out).toContain("esbuild@0.19.8");
    expect(await exited).toBe(0);

    ({ stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "estrella", "--estrella-version"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    }));

    err = await stderr.text();
    out = await stdout.text();
    expect(err).toBe("");
    expect(out).toContain("1.4.1");
    expect(await exited).toBe(0);

    ({ stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "esbuild", "--version"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    }));

    err = await stderr.text();
    out = await stdout.text();
    expect(err).toBe("");
    expect(out).toContain("0.19.8");
    expect(await exited).toBe(0);

    ({ stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "esbuild", "--version"],
      cwd: join(packageDir, "node_modules", "estrella"),
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    }));

    err = await stderr.text();
    out = await stdout.text();
    expect(err).toBe("");
    expect(out).toContain("0.11.23");

    ({ stdout, stderr, exited } = spawn({
      cmd: [bunExe(), "estrella", "build-file.js"],
      cwd: packageDir,
      stdout: "pipe",
      stdin: "pipe",
      stderr: "pipe",
      env,
    }));

    err = await stderr.text();
    out = await stdout.text();
    expect(err).toBe("");
    expect(out).toBe('console.log("hello"),console.log("estrella");\n');
    expect(await exited).toBe(0);
  });
});
