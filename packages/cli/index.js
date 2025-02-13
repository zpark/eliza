#!/usr/bin/env node
const { execSync } = require('child_process')
const pathUtil = require('path')
const fs = require('fs')
const { Command } = require('commander')

const program = new Command()
const { version } = require('./package.json')

program
  .name('elizaos')
  .description('elizaOS CLI - Manage your plugins')
  .version(version);

const plugins = new Command()
  .name("plugins")
  .description("manage elizaOS plugins")

async function getPlugins() {
  const resp = await fetch('https://raw.githubusercontent.com/elizaos-plugins/registry/refs/heads/main/index.json')
  return await resp.json();
}

plugins
  .command("list")
  .description("list available plugins")
  .option("-t, --type <type>", "filter by type (adapter, client, plugin)")
  .action(async (opts) => {
    try {
      const plugins = await getPlugins()
      const pluginNames = Object.keys(plugins)
        .filter(name => !opts.type || name.includes(opts.type))
        .sort()

      console.info("\nAvailable plugins:")
      for (const plugin of pluginNames) {
        console.info(`  ${plugin}`)
      }
      console.info("")
    } catch (error) {
      console.error(error)
    }
  })

plugins
  .command("add")
  .description("add a plugin")
  .argument("<plugin>", "plugin name")
  .action(async (plugin, opts) => {
    // ensure git is installed
    try {
      const gitVersion = execSync('git --version', { stdio: 'pipe' }).toString().trim();
      console.log('using', gitVersion)
    } catch(e) {
      console.error('Please install git to use this utility')
      return
    }

    const plugins = await getPlugins()
    const repoData = plugins[plugin]?.split(':')
    if (!repoData) {
      console.error('Plugin', plugin, 'not found')
      return
    }
    //console.log('p', plugin, 'type', repoData[0], 'repo', repoData[1])
    // repo type
    if (repoData[0] !== 'github') {
      console.error('Plugin', plugin, 'uses', repoData[0], ' but this utility only currently support github')
      return
    }
    const parts = repoData[1].split('/')
    const elizaOSroot = pathUtil.resolve(__dirname, '../..')
    const pkgPath = elizaOSroot + '/packages/' + parts[1]

    // can't add to char file
    if (!fs.existsSync(pkgPath)) {
      // clone it
      console.log('cloning', parts[1], 'to', pkgPath)
      const gitOutput = execSync('git clone https://github.com/' + repoData[1] + ' ' + pkgPath, { stdio: 'pipe' }).toString().trim();
    }
    // add core to plugin
    // # pnpm add @elizaos/core@workspace:* --filter ./packages/client-twitter
    console.log('Making sure plugin has access to @elizaos/core')
    const pluginAddCoreOutput = execSync('pnpm add @elizaos/core@workspace:* --filter ./packages/' + parts[1], { cwd: elizaOSroot, stdio: 'pipe' }).toString().trim();
    //console.log('pluginAddCoreOutput', pluginAddCoreOutput)

    // Read the current package.json
    const packageJsonPath = pkgPath + '/package.json'
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    if (packageJson.name !== '@elizaos-plugins/' + parts[1]) {
      // Update the name field
      packageJson.name = '@elizaos-plugins/' + parts[1]
      console.log('Updating plugins package.json name to', packageJson.name)

      // Write the updated package.json back to disk
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
    }

    //console.log('Update workspace')
    //const updateWorkspaceOutput = execSync('pnpm i --no-frozen-lockfile', { cwd: elizaOSroot, stdio: 'pipe' }).toString().trim();

    // add to agent
    console.log('Adding plugin', plugin, 'to agent/package.json')
    try {
      const pluginAddAgentOutput = execSync('pnpm add ' + plugin + '@workspace:* --filter ./agent', { cwd: elizaOSroot, stdio: 'pipe' }).toString().trim();
      //console.log('pluginAddAgentOutput', pluginAddAgentOutput)
    } catch (e) {
      console.error('error', e)
    }
    // rebuild

    console.log(plugin, 'attempted installation is complete')
    console.log('Remember to add it to your character file\'s plugin field: ["' + plugin + '"]')
  })

program.addCommand(plugins)

program.parse(process.argv)
