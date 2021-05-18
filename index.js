require('dotenv').config();
const util = require('util');
const fs = require('fs-extra');
const path = require('path');
const csv = require('csv-parser');
const copyFilePromise = util.promisify(fs.copyFile);

let csvFileDir, searchRoot, output, devMode;

const log = require('simple-node-logger').createSimpleLogger('output.log');

function init() {
  // check if .env exists
  if (fs.existsSync('.env') == false) {
    log.warn('.env file created, please change the values and try again');
    fs.writeFileSync(
      '.env',
      `CSV= C:\\Users\\User\\Desktop\\MOCK_DATA.csv
SEARCH_ROOT= C:\\Users\\User\\Desktop\\many_files_inside
OUTPUT= C:\\Users\\User\\Desktop\\files
DEV= true`,
      'utf8',
    );
    return false;
  }

  // set env variables and check if directories exist
  csvFileDir = process.env.CSV;
  searchRoot = process.env.SEARCH_ROOT;
  output = process.env.OUTPUT;
  devMode = process.env.DEV;

  if (csvFileDir && !fs.existsSync(csvFileDir)) {
    log.error('CSV not found, make sure .env has the proper path');
    return false;
  }
  if (searchRoot && !fs.existsSync(searchRoot)) {
    log.error('Invalid SEARCH_ROOT, make sure .env has the proper path');
    return false;
  }
  if (output && !fs.existsSync(output)) {
    log.error('Invalid OUTPUT, make sure .env has the proper path');
    return false;
  }

  return true;
}

function getCSVList() {
  return new Promise((r) => {
    const csvSet = new Set();
    fs.createReadStream(csvFileDir)
      .pipe(csv({ headers: false }))
      .on('data', (data) =>
        csvSet.add(data[0].trim().toLowerCase().substring(0, 89)),
      )
      .on('end', () => {
        r(csvSet);
      });
  });
}

function getFilesFromSearch(csvSet) {
  const foundFiles = [];
  const initialCsvSetLength = csvSet.size;

  function getNext(dirPath) {
    let skipDir = false;
    let files;
    console.log(path.join(dirPath));
    try {
      files = fs.readdirSync(dirPath);
    } catch (error) {
      skipDir = true;
      if (devMode) log.warn(`Skipping - ${dirPath}`);
    }
    if (path.join(dirPath) === path.join(output)) skipDir = true;
    if (skipDir) return;

    if (csvSet.size) {
      files.forEach(function (file) {
        const fileTrimmed = file.trim().toLowerCase().substring(0, 89);
        let skipDir = false;
        let isDirectory;
        try {
          isDirectory = fs.statSync(dirPath + '/' + file).isDirectory();
        } catch (error) {
          skipDir = true;
          if (devMode) log.warn(`Skipping - ${dirPath + '/' + file}`);
        }

        if (skipDir) return;
        if (isDirectory) {
          getNext(dirPath + '/' + file);
        } else if (csvSet.has(fileTrimmed)) {
          const foundFile = { dir: path.join(dirPath, file), name: file };
          console.log(foundFile.dir, path.join(output, foundFile.name));
          try {
            fs.copySync(foundFile.dir, path.join(output, foundFile.name));
            foundFiles.push(foundFile);
            csvSet.delete(fileTrimmed);

            console.log(
              `(${foundFiles.length}/${initialCsvSetLength}) - "${foundFile.name}". Dir - "${foundFile.dir}"`,
            );
            log.info(
              `(${foundFiles.length}/${initialCsvSetLength}) - "${foundFile.name}". Dir - "${foundFile.dir}"`,
            );
          } catch (err) {
            log.error(`Copy failed - ${foundFile.name} - ${foundFile.dir}`);
          }
        }
      });
    }
  }
  getNext(searchRoot);
  return { foundFiles, initialCsvSetLength };
}

module.exports = async () => {
  if (!init()) return;

  const csvSet = await getCSVList();
  log.info(`Search start...`);
  const { foundFiles, initialCsvSetLength } = getFilesFromSearch(csvSet);
  log.info(`Search end...`);

  if (csvSet.size)
    log.warn(`Not found (${csvSet.size}) - "${[...csvSet].join('", "')}"`);
  log.info(`FINISH - ${foundFiles.length}/${initialCsvSetLength}`);
};
