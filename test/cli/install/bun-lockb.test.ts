import { file, spawn, write } from "bun";
import { afterAll, beforeAll, expect, it } from "bun:test";
import { copyFile, exists, open, writeFile } from "fs/promises";
import { bunExe, bunEnv as env, isWindows, runBunInstall, VerdaccioRegistry } from "harness";
import { join } from "path";

const registry = new VerdaccioRegistry();

beforeAll(async () => {
  await registry.start();
});

afterAll(() => {
  registry.stop();
});

it("should not print anything to stderr when running bun.lockb", async () => {
  const { packageDir, packageJson } = await registry.createTestDir({ saveTextLockfile: false });

  // copy bar-0.0.2.tgz to package_dir
  await copyFile(join(__dirname, "bar-0.0.2.tgz"), join(packageDir, "bar-0.0.2.tgz"));

  // Create a simple package.json
  await writeFile(
    packageJson,
    JSON.stringify({
      name: "test-package",
      version: "1.0.0",
      dependencies: {
        "dummy-package": "file:./bar-0.0.2.tgz",
      },
    }),
  );

  // Run 'bun install' to generate the lockfile
  const installResult = spawn({
    cmd: [bunExe(), "install"],
    cwd: packageDir,
    env,
  });
  await installResult.exited;

  // Ensure the lockfile was created
  expect(await exists(join(packageDir, "bun.lockb"))).toBe(true);

  // Assert that the lockfile has the correct permissions
  const file = await open(join(packageDir, "bun.lockb"), "r");
  const stat = await file.stat();

  // in unix, 0o755 == 33261
  let mode = 33261;
  // ..but windows is different
  if (isWindows) {
    mode = 33206;
  }
  expect(stat.mode).toBe(mode);

  // create a .env
  await writeFile(join(packageDir, ".env"), "FOO=bar");

  // Now test 'bun bun.lockb'
  const { stdout, stderr, exited } = spawn({
    cmd: [bunExe(), "bun.lockb"],
    cwd: packageDir,
    stdout: "pipe",
    stderr: "pipe",
    env,
  });

  const stdoutOutput = await stdout.text();
  expect(stdoutOutput).toBe(
    `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.\n# yarn lockfile v1\n# bun ./bun.lockb --hash: 8B7A1C2DA8966A48-f4830e6e283fffe9-DE5BD0E91FD9910F-f0bf88071b3f7ec9\n\n\n\"bar@file:./bar-0.0.2.tgz\":\n  version \"./bar-0.0.2.tgz\"\n  resolved \"./bar-0.0.2.tgz\"\n`,
  );

  const stderrOutput = await stderr.text();
  expect(stderrOutput).toBe("");

  expect(await exited).toBe(0);
});

it("should continue using a binary lockfile if it exists", async () => {
  const { packageDir, packageJson } = await registry.createTestDir({ saveTextLockfile: false });

  await write(
    packageJson,
    JSON.stringify({
      name: "binary-lockfile-package",
      version: "1.0.0",
      dependencies: {
        "no-deps": "1.0.0",
      },
    }),
  );

  await runBunInstall(env, packageDir);
  const firstLockfile = await file(join(packageDir, "bun.lockb")).text();

  // now remove the saveTextLockfile option from bunfig
  await registry.writeBunfig(packageDir);

  // another install will keep the existing binary lockfile
  await runBunInstall(env, packageDir, { savesLockfile: false });
  expect(await exists(join(packageDir, "bun.lock"))).toBe(false);
  const secondLockfile = await file(join(packageDir, "bun.lockb")).text();
  expect(firstLockfile).toBe(secondLockfile);

  // adding a package will add to the binary lockfile
  await runBunInstall(env, packageDir, { packages: ["a-dep"] });
  expect(await exists(join(packageDir, "bun.lock"))).toBe(false);
  const thirdLockfile = await file(join(packageDir, "bun.lockb")).text();
  expect(thirdLockfile).not.toBe(secondLockfile);
});
