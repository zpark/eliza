import { execa } from "execa";
import path from "node:path";
import { logger } from "@/src/utils/logger";
import { runBunCommand } from "@/src/utils/run-bun";
import { promises as fs } from "node:fs";

export async function installPlugin(
  pluginName: string,
  cwd: string,
): Promise<void> {
  // Remove 'github:' or leading '@' prefix if present
  const cleanedName = pluginName.replace(/^github:|^@/, "");
  let installed = false;
  try {
    //logger.info(`Attempting to install ${pluginName} using bun add...`);
    //await runBunCommand(["add", `${pluginName}`], cwd);
    //logger.success(`Successfully installed ${pluginName} via bun add.`);
    //installed = true;
    // Set the directory to clone into the packages folder (each plugin gets its own subfolder)
    const cloneDir = path.join(cwd, "packages", cleanedName.replace(/\S+\//, ""));
    logger.info(`Cloning ${pluginName} from https://github.com/${cleanedName}.git to ${cloneDir}`);
    await execa("git",["clone", `https://github.com/${cleanedName}.git`, cloneDir],{ cwd, stdio: "inherit" });
    logger.success(`Successfully cloned repository for ${cleanedName}.`);
    installed = true;
  } catch (error: any) {
    logger.warn(
      `failed to install packages for ${cleanedName}, falling back: ${error.message}`
    );
  }

  if (installed) {
    // Try to read the package.json file from the cloned plugin repo
    let pkgName = cleanedName;
    const pkgPath = path.join(cwd, "packages", cleanedName.replace(/\S+\//, ""), "package.json");
    try {
      const pkgContent = await fs.readFile(pkgPath, "utf-8");
      const pkg = JSON.parse(pkgContent);
      if (pkg.name) {
        pkgName = pkg.name;
        logger.info(`Found package.json name: ${pkgName}`);
        logger.info(`Add ${pkgName} to your character's plugins config (packages/agent/defaultCharacter.ts)`);
      }
    } catch (err: any) {
      logger.warn(`Could not read package.json from ${pkgPath}: ${err.message}`);
    }
  }
}