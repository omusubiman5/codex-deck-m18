import { createHash } from "node:crypto";
import { cp, chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = String(process.env.CODEX_DECK_RELEASE_VERSION || packageJson.version);
if (!/^\d+\.\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
  throw new Error(`Invalid release version: ${version}`);
}

const pluginSource = join(root, "dist-vsd-craft", "com.simeo.codex-deck.sdPlugin");
const manifest = JSON.parse(await readFile(join(pluginSource, "manifest.json"), "utf8"));
if (manifest.SDKVersion !== 1 || manifest.CodePathWin !== "bin/plugin.mjs" || manifest.CodePathMac !== "bin/plugin.mjs") {
  throw new Error("Build the validated VSD Craft plugin before packaging installers.");
}

const output = join(root, "outputs", `vsd-craft-installers-v${version}`);
const temporary = await mkdtemp(join(tmpdir(), "codex-deck-vsd-installers-"));
try {
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  const windowsName = `codex-deck-vsd-craft-windows-v${version}`;
  const macName = `codex-deck-vsd-craft-macos-v${version}`;
  const windowsRoot = join(temporary, windowsName);
  const macRoot = join(temporary, macName);
  const macLauncherRoot = join(macRoot, "launcher-macos");
  await Promise.all([
    mkdir(windowsRoot, { recursive: true }),
    mkdir(macLauncherRoot, { recursive: true })
  ]);

  await Promise.all([
    cp(pluginSource, join(windowsRoot, "plugin", basename(pluginSource)), { recursive: true }),
    cp(pluginSource, join(macRoot, "plugin", basename(pluginSource)), { recursive: true }),
    cp(join(root, "scripts", "installers", "Install Codex Deck.cmd"), join(windowsRoot, "Install Codex Deck.cmd")),
    cp(join(root, "scripts", "installers", "Install-CodexDeck-VSDCraft.ps1"), join(windowsRoot, "Install-CodexDeck-VSDCraft.ps1")),
    cp(join(root, "scripts", "installers", "README-Windows.txt"), join(windowsRoot, "README.txt")),
    cp(join(root, "scripts", "installers", "Install Codex Deck.command"), join(macRoot, "Install Codex Deck.command")),
    cp(join(root, "scripts", "installers", "README-macOS.txt"), join(macRoot, "README.txt")),
    cp(join(root, "release", "codex-deck-launcher-macos", "codex-deck-macos.mjs"), join(macLauncherRoot, "codex-deck-macos.mjs")),
    cp(join(root, "release", "codex-deck-launcher-macos", "start-codex-deck.sh"), join(macLauncherRoot, "start-codex-deck.sh")),
    cp(join(root, "release", "codex-deck-launcher-macos", "Start Codex Deck.command"), join(macLauncherRoot, "Start Codex Deck.command")),
    cp(join(root, "LICENSE"), join(macLauncherRoot, "LICENSE")),
    cp(join(root, "LICENSE"), join(windowsRoot, "LICENSE")),
    cp(join(root, "LICENSE"), join(macRoot, "LICENSE"))
  ]);
  await chmod(join(macRoot, "Install Codex Deck.command"), 0o755);
  await chmod(join(macRoot, "launcher-macos", "start-codex-deck.sh"), 0o755);
  await chmod(join(macRoot, "launcher-macos", "Start Codex Deck.command"), 0o755);

  const windowsArchive = join(output, `${windowsName}.zip`);
  const macArchive = join(output, `${macName}.zip`);
  await createZip(temporary, windowsName, windowsArchive);
  await createZip(temporary, macName, macArchive);
  await verifyArchive(windowsArchive, [
    `${windowsName}/Install Codex Deck.cmd`,
    `${windowsName}/Install-CodexDeck-VSDCraft.ps1`,
    `${windowsName}/plugin/com.simeo.codex-deck.sdPlugin/manifest.json`
  ]);
  await verifyArchive(macArchive, [
    `${macName}/Install Codex Deck.command`,
    `${macName}/launcher-macos/start-codex-deck.sh`,
    `${macName}/plugin/com.simeo.codex-deck.sdPlugin/manifest.json`
  ], new Set([
    `${macName}/Install Codex Deck.command`,
    `${macName}/launcher-macos/start-codex-deck.sh`,
    `${macName}/launcher-macos/Start Codex Deck.command`
  ]));

  const archives = [windowsArchive, macArchive];
  const checksums = [];
  for (const archive of archives) {
    const hash = createHash("sha256").update(await readFile(archive)).digest("hex");
    checksums.push(`${hash}  ${basename(archive)}`);
  }
  await writeFile(join(output, "SHA256SUMS.txt"), `${checksums.join("\n")}\n`, "utf8");
  console.log(`VSD Craft installers created: ${output}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function createZip(parent, directoryName, destination) {
  const source = join(parent, directoryName);
  const entries = await collect(source, directoryName);
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8");
    const sourceData = entry.directory ? Buffer.alloc(0) : await readFile(entry.path);
    const compressed = entry.directory ? sourceData : deflateRawSync(sourceData, { level: 9 });
    const crc = crc32(sourceData);
    const { time, date } = dosDateTime(entry.modified);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(entry.directory ? 0 : 8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(sourceData.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(entry.directory ? 0 : 8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(sourceData.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((entry.mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(destination, Buffer.concat([...localParts, ...centralParts, end]));
}

async function collect(path, relative) {
  const info = await stat(path);
  if (!info.isDirectory()) {
    const executable = /(?:\.command|\.sh)$/u.test(relative);
    return [{ path, name: relative, directory: false, mode: executable ? 0o100755 : 0o100644, modified: info.mtime }];
  }
  const result = [{ path, name: `${relative}/`, directory: true, mode: 0o40755, modified: info.mtime }];
  for (const child of (await readdir(path)).sort()) result.push(...await collect(join(path, child), join(relative, child)));
  return result;
}

async function verifyArchive(path, required, executable = new Set()) {
  const data = await readFile(path);
  const entries = readCentralDirectory(data);
  for (const name of required) if (!entries.has(name)) throw new Error(`${basename(path)} is missing ${name}`);
  for (const name of executable) {
    const mode = entries.get(name)?.mode ?? 0;
    if ((mode & 0o111) === 0) throw new Error(`${basename(path)} did not preserve executable mode for ${name}`);
  }
}

function readCentralDirectory(data) {
  const result = new Map();
  for (let offset = 0; offset <= data.length - 46;) {
    const signature = data.readUInt32LE(offset);
    if (signature !== 0x02014b50) { offset += 1; continue; }
    const nameLength = data.readUInt16LE(offset + 28);
    const extraLength = data.readUInt16LE(offset + 30);
    const commentLength = data.readUInt16LE(offset + 32);
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    result.set(name, { mode: data.readUInt32LE(offset + 38) >>> 16 });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}

function dosDateTime(value) {
  const year = Math.max(1980, value.getFullYear());
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate()
  };
}

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
