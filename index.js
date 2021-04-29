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
    const csvObject = {};
    fs.createReadStream(csvFileDir)
      .pipe(csv({ headers: false }))
      .on('data', (data) => (csvObject[data[0]] = true))
      .on('end', () => {
        r(csvObject);
      });
  });
}

function getFilesFromSearch(csvObject) {
  const foundFiles = [];
  const csvObjectLength = Object.keys(csvObject).length;
  let currentCsvObjectLength = csvObjectLength;

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

    if (currentCsvObjectLength) {
      files.forEach(function (file) {
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
        } else if (csvObject[file]) {
          const foundFile = { dir: path.join(dirPath, file), name: file };
          console.log(foundFile.dir, path.join(output, foundFile.name));
          try {
            fs.copySync(foundFile.dir, path.join(output, foundFile.name));
            foundFiles.push(foundFile);
            delete csvObject[file];
            currentCsvObjectLength--;

            log.info(
              `(${foundFiles.length}/${csvObjectLength}) - "${foundFile.name}". Dir - "${foundFile.dir}"`,
            );
          } catch (err) {
            log.error(`Copy failed - ${foundFile.name} - ${foundFile.dir}`);
          }
        }
      });
    }
  }
  getNext(searchRoot);
  return { foundFiles, csvObjectLength, currentCsvObjectLength };
}

module.exports = async () => {
  if (!init()) return;

  const csvObject = await getCSVList();
  log.info(`Search start...`);
  const {
    foundFiles,
    csvObjectLength,
    currentCsvObjectLength,
  } = getFilesFromSearch(csvObject);
  log.info(`Search end...`);

  if (currentCsvObjectLength)
    log.warn(
      `Not found (${currentCsvObjectLength}) - "${Object.keys(csvObject).join(
        '", "',
      )}"`,
    );
  log.info(`FINISH - ${foundFiles.length}/${csvObjectLength}`);
};
