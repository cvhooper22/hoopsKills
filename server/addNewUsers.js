const passes = './dataDrops/ROCdrop11_08_19.csv';
const csv = require('csvtojson');
const fs = require('fs');

const configuration = require('./knexfile.js')['development'];
const knex = require('knex')(configuration);

const guidBase = '11082019_';

async function perform () {
  const data = await csv().fromFile(passes);
  // console.log('passes completed?', data);
  console.log('this many read', data.length);
  const lookupPromises = [];
  const insertPromsies = [];
  data.forEach(pass => {
    lookupPromises.push(knex('users').where({ barcode: pass['QR Code']}));
  })
  const results = await Promise.all(lookupPromises);
  // console.log('lookups complete?', results);
  const skipIndices = results.reduce((aggr, val, index) => {
    if (val.length) {
      aggr.push(index);
    }
    return aggr
  }, []);
  console.log('skip these', skipIndices);
  data.forEach((pass, index) => {
    if (!skipIndices.includes(index)) {
      insertPromsies.push(knex('users').insert({
        guid: `${guidBase}${index}`,
        student_id: pass['Student ID'],
        email: pass['_EmailPhone_'],
        name: pass['CustomerName'],
        barcode: pass['QR Code'],
        times_visited: 0,
      }));
    }
  });
  console.log('this many inserts coming', insertPromsies.length);
  const insertResults = await Promise.all(insertPromsies);
  // console.log('inserting finished, here are results', insertResults);
  knex.destroy();
}

perform();
// console.log('handles?', process._getActiveHandles());