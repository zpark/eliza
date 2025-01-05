import os from "os";
const platform = os.platform();

if (
    platform === "linux" &&
    !(os.release().includes("ubuntu") || os.release().includes("debian"))
) {
    // DO NOT CHANGE THIS TO ELIZALOGGER, this file cannot depends on any workspace otherwise we can't build the workspace
    console.log(
        "Skipping playwright installation on unsupported platform:",
        platform
    );
} else {
    const { execSync } = await import("child_process");
    execSync("npx playwright install-deps && npx playwright install", {
        stdio: "inherit",
    });
}
