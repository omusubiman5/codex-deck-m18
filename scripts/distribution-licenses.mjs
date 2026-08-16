import { cp, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function packageRoot(inputPath) {
  const normalized = inputPath.replaceAll("\\", "/");
  const marker = "/node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return undefined;
  const parts = normalized.slice(index + marker.length).split("/");
  const packageParts = parts[0]?.startsWith("@") ? parts.slice(0, 2) : parts.slice(0, 1);
  return normalized.slice(0, index + marker.length) + packageParts.join("/");
}

async function readLicense(root) {
  const entries = await readdir(root);
  const filename = entries.find((entry) => /^(?:licen[cs]e|copying|notice)(?:\.|$)/iu.test(entry));
  if (!filename) throw new Error(`Bundled dependency has no license file: ${root}`);
  return { filename, text: await readFile(resolve(root, filename), "utf8") };
}

export async function writeDistributionLicenses(output, metafile) {
  const roots = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const root = packageRoot(resolve(input));
    if (root) roots.add(root);
  }

  const packages = [];
  for (const root of roots) {
    const metadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
    const license = await readLicense(root);
    packages.push({
      id: `${metadata.name}@${metadata.version}`,
      declaredLicense: metadata.license ?? "not declared",
      filename: license.filename,
      text: license.text.trim()
    });
  }
  packages.sort((left, right) => left.id.localeCompare(right.id, "en"));

  const projectNotices = (await readFile(resolve("THIRD_PARTY_NOTICES.md"), "utf8")).trim();
  const dependencyNotices = packages.map((item) => [
    `## ${item.id}`,
    "",
    `Declared license: ${item.declaredLicense} (source file: ${item.filename})`,
    "",
    "```text",
    item.text,
    "```"
  ].join("\n")).join("\n\n");

  await cp(resolve("LICENSE"), resolve(output, "LICENSE"));
  await writeFile(
    resolve(output, "THIRD_PARTY_NOTICES.md"),
    `${projectNotices}\n\n# Bundled JavaScript dependency licenses\n\n${dependencyNotices}\n`,
    "utf8"
  );
}

export async function copyDistributionLicenses(source, output) {
  for (const filename of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
    await cp(resolve(source, filename), resolve(output, filename));
  }
}
