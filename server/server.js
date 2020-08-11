let ex = require('express');
let cors = require('cors');
let qrcode = require('qrcode');
let moment = require('moment');
const { createCanvas, loadImage, Image } = require('canvas')
// https://stackoverflow.com/questions/16088824/serve-static-files-and-app-get-conflict-using-express-js


const configuration = require('./knexfile.js')['development'];
const knex = require('knex')(configuration);


let port = process.env.PORT || 4891;
const superSecretId = '19842011';
const server = ex();
const corsOptions = {
  origin: [
    'http://localhost:7777',
    process.env.CLIENT_URL_HTTP,
    process.env.CLIENT_URL,
  ],
};

server.use(ex.static(__dirname + '/../public'));
server.use(cors(corsOptions));

const options = {
  type: 'image/jpeg',
  errorCorrectionLevel: 'H',
  renderOpts: {
    scale: 12,
  },
};

server.get('/qrcode/:id', function (req, resp) {
  console.log('get a qr code', req.params.id);
  if (req.params.id !== superSecretId) {
    knex.from('users').select().where('student_id', req.params.id)
      .then((user) => {
        if (user.length) {
          console.log('user', user[0]);
          const canvas = createCanvas(252, 322);
          const ctx = canvas.getContext('2d');

          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, 252, 322);
          qrcode.toDataURL(user[0].barcode, options)
            .then ((url) => {
              loadImage('./logos.png').then((image => {
                  console.log('image loaded, draw MACU logo');
                  ctx.drawImage(image, 10, 252);
                  const img = new Image();
                  img.onload = () => ctx.drawImage(img, 10, 10, 232, 232);
                  img.onerror = (err) => { return Promise.reject(err) };
                  // console.log('thecode', url);
                  img.src = url;
                  // console.log('result:\n', canvas.toDataURL());
                  resp.send(canvas.toDataURL());
                  knex('users')
                    .where('student_id', user[0].student_id)
                    .update({
                      times_visited: user[0].times_visited + 1,
                      last_visited: moment().utc().toISOString(),
                    })
                    .then(res => console.log('\tsuccessfully updated user', user[0].student_id));
              }));
            })
            .catch((err) => {
              resp.status(500).send(`There was an error generating your code::${err}`);
            });
        } else {
          resp.status(404).send('Student Id Not Found');
        }
      })
      .catch((error) => {
        resp.status(500).send(`Error looking up user data: ${error}`);  
      });
  } else {
    qrcode.toDataURL('1001001001', options, (err, url) => {
      if (err) {
        resp.status(500).send(`There was an error generating your code::${err}`);
      } else {
        resp.send(url);
      }
    });
  }
  
    // .catch((err) => {
    //   console.log(err);
    //   resp.status(500).send({ error: err, message: 'Error loading team gamelog' });
    // });
});

server.listen(port).on('error', (err) => console.log('error', err));
console.log('successfully started server on port ', port);