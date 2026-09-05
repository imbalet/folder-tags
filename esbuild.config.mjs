import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const production = process.argv.includes("production");

const vaultPath = process.env.OBSIDIAN_VAULT;

if (!vaultPath) {
  throw new Error("OBSIDIAN_VAULT is not set.");
}

const pluginDir = path.join(
  vaultPath,
  ".obsidian",
  "plugins",
  "folder-templates",
);

const options = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  target: "es2018",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: production,
};

function copyToVault() {
  fs.mkdirSync(pluginDir, {
    recursive: true,
  });

  fs.copyFileSync("main.js", path.join(pluginDir, "main.js"));

  fs.copyFileSync("styles.css", path.join(pluginDir, "styles.css"));

  fs.copyFileSync("manifest.json", path.join(pluginDir, "manifest.json"));
}

if (production) {
  await esbuild.build(options);

  console.log("Built production plugin.");
} else {
  const context = await esbuild.context(options);

  await context.watch();

  copyToVault();

  fs.watch("styles.css", () => {
    copyToVault();
    console.log("Copied styles.css → vault");
  });

  fs.watch("manifest.json", () => {
    copyToVault();
    console.log("Copied manifest.json → vault");
  });

  console.log(`Watching → ${pluginDir}`);
}
