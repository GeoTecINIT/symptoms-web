import { promisify } from 'util';
import { join } from 'path';
import { exists as exs } from 'fs';
import { exec as exe } from 'child_process';

import * as sitemap from './sitemap.json';
const SITE_FOLDER_NAME = 'public';

const exists = promisify(exs);
const exec = promisify(exe);

const siteFolder = join(__dirname, SITE_FOLDER_NAME);

async function prepareSiteMap(sitemap) {
  console.log(`Preparing '${SITE_FOLDER_NAME}' sitemap...`);
  const { stderr } = await exec(`rm -rf ${siteFolder}`);
  if (stderr !== '') {
    throw Error(
      `Could not clean up ${siteFolder} folder, please check write permissions`
    );
  }
  await execCommand(`mkdir ${siteFolder}`, '.');

  for (const site of sitemap) {
    await prepareSiteFiles(site);
  }
  console.log(`DONE Preparing '${SITE_FOLDER_NAME}' sitemap`);
}

async function prepareSiteFiles(site) {
  console.log(`Preparing site ${site.source}...`);
  const basePath =
    site.basePath.substring(0, 1) === '/'
      ? site.basePath.substring(1)
      : site.basePath;
  const source = join(__dirname, site.source);
  const destination = join(siteFolder, site.basePath);
  const siteToPrepare = { basePath, source, destination };

  if (site.angularApp) {
    await prepareAngularSite(siteToPrepare, site.productionEnv);
  } else {
    await prepareHTML5Site(siteToPrepare);
  }
  console.log(`DONE Preparing site ${site.source}`);
}

async function prepareAngularSite(site, productionEnv) {
  await buildApp(site.source, site.basePath, productionEnv);
  const buildFolder = join(site.source, 'dist');
  await execCommand(`cp -r ${buildFolder}/ ${site.destination}`, '.');
}

async function prepareHTML5Site(site) {
  await execCommand(`cp -r ${site.source}/ ${site.destination}`, '.');
}

async function buildApp(dirPath, basePath, productionEnv) {
  console.log(`Running "npm install" on ${dirPath}...`);
  await execCommand('npm i', dirPath);
  console.log(`DONE Running "npm install" on ${dirPath}`);

  console.log(`Building application on ${dirPath}...`);
  const rootDirParams = `--baseHref=/${basePath}/ --deployUrl=/${basePath}/`;
  const optimizationParams = '--aot --optimization --buildOptimizer';
  const cachingParams =
    '--outputHashing=all --namedChunks=false --vendorChunk=false';
  const extraFileParams = '--sourceMap=false --extractLicenses --extractCss';
  const extraParams = productionEnv ? '--prod' : '';
  const buildParams = `${rootDirParams} ${optimizationParams} ${cachingParams} ${extraFileParams} ${extraParams}`;
  await execCommand(`ng build ${buildParams}`, dirPath);
  console.log(`DONE Building application on ${dirPath}`);

  const buildDone = await exists(join(dirPath, 'dist'));
  if (!buildDone) {
    throw new Error(`Application on ${dirPath} has was not built correctly!`);
  }
}

async function execCommand(command, directory) {
  const { stderr, stdout } = await exec(`cd ${directory}; ${command}`);
  if (stderr !== '') {
    console.log(stderr);
  }
  return stdout;
}

try {
  prepareSiteMap(sitemap.default);
} catch (e) {
  console.error(e);
}
