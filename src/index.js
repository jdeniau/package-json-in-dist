import path from "node:path";
import fs from "node:fs";

const DEFAULT_DIST_DIRECTORY = process.argv[2] ?? "dist/";

const suffixBySlash = (dir) => (dir.endsWith("/") ? dir : dir + "/");

const DIST_DIRECTORY = suffixBySlash(DEFAULT_DIST_DIRECTORY);

const packageJsonPath = path.resolve("package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath));

const newPackageJson = { ...packageJson };

// make package public
newPackageJson.private = false;

// remove "dist" from "main" and "types"
if (newPackageJson.main) {
  newPackageJson.main = newPackageJson.main.replace(DIST_DIRECTORY, "");
}

if (newPackageJson.types) {
  newPackageJson.types = newPackageJson.types.replace(DIST_DIRECTORY, "");
}

// handle "exports" key
for (const key in newPackageJson.exports) {
  // remove "development" key from exports, and of single entrypoint, then make the values simpler
  if (newPackageJson.exports[key].development) {
    delete newPackageJson.exports[key].development;
  }

  if (
    Object.keys(newPackageJson.exports[key]).length === 1 &&
    newPackageJson.exports[key].default
  ) {
    newPackageJson.exports[key] = newPackageJson.exports[key].default;
  }

  // remove "dist" from exports paths
  if (typeof newPackageJson.exports[key] === "string") {
    newPackageJson.exports[key] = newPackageJson.exports[key].replace(
      DIST_DIRECTORY,
      ""
    );
  } else {
    for (const subKey in newPackageJson.exports[key]) {
      newPackageJson.exports[key][subKey] = newPackageJson.exports[key][
        subKey
      ].replace(DIST_DIRECTORY, "");
    }
  }
}

// remove "files", "scripts", "devDependencies" keys
delete newPackageJson.files;
delete newPackageJson.scripts;
delete newPackageJson.devDependencies;

fs.mkdirSync(path.resolve(DIST_DIRECTORY), { recursive: true });

fs.writeFileSync(
  path.resolve(DIST_DIRECTORY, "package.json"),
  JSON.stringify(newPackageJson, null, 2)
);
