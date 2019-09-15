const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { Translate } = require('@google-cloud/translate');
const translate = new Translate({ 'ID': 'Z-XXXXX-YYYYYYYYYYY' });
const _cliProgress = require('cli-progress');
const _colors = require('colors');
const colors = require('colors/safe');

// You've successfully set up the project a-trans (ID: Z-XXXXX-YYYYYYYYYYY) and created the service account, starting-account-AAAAAAAAAAAA.
process.env.GOOGLE_APPLICATION_CREDENTIALS = 'gapi-key.json'; // export GOOGLE_APPLICATION_CREDENTIALS="gapi-key.json"

const DIR = './assets/i18n/';
const EXTENSION = '.json';
const REQUEST_DELAY = 0.1 // 1 = 1sec

const getLang = (fName) => fName.substr(fName.lastIndexOf('/') + 1).replace('.json', '');

const progressBar = new _cliProgress.SingleBar({
  format: 'Translation |' + _colors.yellow('{bar}') + '| {percentage}% || {value}/{total} phrases',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
});

const readFiles = async (dir) => {
  const files = await fs.readdirSync(dir, { withFileTypes: true })
    .filter(item => !item.isDirectory() && path.extname(item.name) === EXTENSION && getLang(path.basename(item.name, EXTENSION)).toLowerCase() !== 'en')
    .map(item => `${DIR}${item.name}`);
  return Promise.resolve(files);
}

const getOriginalData = async (files) => {
  const oData = await files.reduce((prev, curr) => {
    let data = require(curr);
    prev.push({
      '___file': curr,
      '___totalPhrases': Object.keys(data).length,
      'data': data
    });
    return prev;
  }, []);
  return Promise.resolve(oData);
}

const dataObjToArray = (arr) => 
  arr.reduce((acc, cur) => {
    const data = Object.keys(cur.data).reduce((newArr, curEl) => {
      newArr.push([curEl, cur.data[curEl]]);
      return newArr;
    }, []);

    data['___file'] = cur.___file;
    data['___totalPhrases'] = cur.___totalPhrases;

    acc.push(data);
    return acc
  }, []);


const dataArrayToObject = (arr) =>
  arr.reduce((acc, cur) => {
    const block = {};
    block.___file = cur['___file'];
    block.___totalPhrases = cur['___totalPhrases'];
    block.___translated = cur['___translated'];
    block.___noNeedTranslation = cur['___noNeedTranslation'];

    block.data = cur.reduce((newObj, curEl) => {
      newObj[curEl[0]] = curEl[1]
      return newObj
    }, {})

    acc.push(block);
    return acc
  }, []);


const goTranslate = async (arr) =>
  arr.reduce(async (pAcc, block) => {
    const acc = await pAcc;
    const targetLang = getLang(block.___file);
    let ___translated = 0, ___noNeedTranslation = 0;

    const translatedBlock = await block.reduce(async (pPhrase, cur) => {
      const transPhrase = await pPhrase
      if (cur[1] == '') {
        //
        // PAUSE
        // ... [
        let waitTill = new Date(new Date().getTime() + REQUEST_DELAY * 1000); while (waitTill > new Date()) { };
        // ] ... 
        // PAUSE
        //
        const translatedPhrase = await translate.translate(cur[0], targetLang);
        ++___translated;
        transPhrase.push([cur[0], translatedPhrase[0]]);
      } else {
        ++___noNeedTranslation;
        transPhrase.push([cur[0], cur[1]]);
      }

      progressBar.increment(1);
      return transPhrase;

    }, Promise.resolve([]));

    translatedBlock['___noNeedTranslation'] = ___noNeedTranslation;
    translatedBlock['___translated'] = ___translated;
    translatedBlock['___file'] = block.___file;
    translatedBlock['___totalPhrases'] = block.___totalPhrases;

    acc.push(translatedBlock);
    return acc;
  }, Promise.resolve([]));


const countTotal = (arr) => 
  arr.reduce((acc, curr) => {
    acc.grandTotalPhrases = (acc.grandTotalPhrases || 0) + curr.___totalPhrases;
    acc.grandTotal4Translate = (acc.grandTotal4Translate || 0) + curr.reduce((accJ, curJ) => ((curJ[1] == '' && (accJ += 1)), accJ), 0)
    return acc
  }, {});


const main = async () => {
  const startTimer = +new Date();

  const files = await readFiles(DIR);
  const originalData = await getOriginalData(files);
  const dataArray = dataObjToArray(originalData);
  const grandTotalPhraseStat = countTotal(dataArray);

  ///// Google Translate Restriction for free key: ~1000 phrase per hour !
  // if (grandTotalPhraseStat.grandTotal4Translate >= 1000) { 
  //   const ifAgree = readline.createInterface({
  //     input: process.stdin,
  //     output: process.stdout
  //   });

  //   console.log(colors.bold.red('\n            !!! ATTENTION !!!\n'), colors.red(`Your files contain ${grandTotalPhraseStat.grandTotal4Translate} phrases for translation. \n This amount exceeds Google’s limits per hour.`));
  //   ifAgree.question(colors.bold.red('      Want to continue anyway?(Y/N)'), (answer) => {
  //     answer.toLowerCase === "n" && process.exit();
  //   });
  //   ifAgree.close();
  // }


  const total = dataArray.reduce((p, c) => p += c.___totalPhrases, 0);

  progressBar.start(total, 0);

  const translatedArray = await goTranslate(dataArray);
  const dataObject = dataArrayToObject(translatedArray);

  writeToFile(dataObject);

  progressBar.stop();
  const endTimer = +new Date();
  console.log(colors.underline.bold.cyan(`\nTranslation Overall Statistics (~${((endTimer - startTimer) / 1000 / total).toFixed(2)} t/sec | incl. delay: ${REQUEST_DELAY})\n`));
}

const writeToFile = async (data) => {
  const res = await data;
  return res.reduce((acc, curr) => {
    console.log(`[ File: ${colors.cyan(curr.___file)} ] Lang: ${colors.bold.cyan(getLang(curr.___file))} | TOTAL: Phrases (${colors.bold.green(curr.___totalPhrases)})  Translated (${colors.green(curr.___translated)})  No need translation (${colors.yellow(curr.___noNeedTranslation)})`)
    processFile(curr.___file, curr.data);
    return ++acc
  }, 0)

}

const processFile = async (file, data) => {
  const output = JSON.stringify(data, null, 2);
  fs.writeFileSync(file, output)
}


main()
