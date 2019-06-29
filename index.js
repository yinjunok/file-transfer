const path = require('path');
const Koa = require('koa');
const klawSync = require('klaw-sync');
const fse = require('fs-extra');
const fs = require('fs');
const os = require('os');
const Router = require('@koa/router');
const koaBody = require('koa-body');
const download = require('download');
const moment = require('moment');

const render = require('koa-ejs');

const SAVE_DIR = path.resolve(__dirname, './download');
const TMP_DIR = os.tmpdir();
const URL = 'https://file.bald.icu/';

const app = new Koa();
const router = new Router();

render(app, {
  root: path.join(__dirname, 'public'),
  layout: false,
  viewExt: 'html',
  cache: false,
  debug: true
});

router.get('/', async (ctx, next) => {
  return await ctx.render('index');
})

// 初始化
;(async () => {
  fse.ensureDir(SAVE_DIR)
  .then(() => {
    console.log('success!')
  })
  .catch(err => {
    console.error(err)
  });
})();

// 定时删除超过三天的文件
function cleanDownload() {
  const paths = klawSync(SAVE_DIR, { nodir: true, });
  const now = moment();
  const needDel = paths.filter(p => {
    const diff = now.diff(moment(p.stats.birthtime), 'days');
    if (diff >= 3) return true;
    return false;
  }); 

  needDel.forEach(f => {
    fse.remove(path.dirname(f.path));
  });
}
cleanDownload();
const delayMs = 1 * 24 * 60 * 60 * 1000;
setInterval(cleanDownload, delayMs);

router.get('/api/download/list', (ctx, next) => {
  const paths = klawSync(SAVE_DIR, { nodir: true, });
  const now = moment();
  paths.forEach(p => {
    const re = /(download)(\\|\/)+.+$/;
    const relativePath = p.path.match(re);
    p.url = URL + relativePath[0];
    const replaceRe = /\\/g;
    p.url = p.url.replace(replaceRe, '\/');
    p.basename = path.basename(p.path);
    // 剩余时间
    p.rest = 3 - now.diff(moment(p.stats.birthtime), 'days');
  });
  ctx.body = {
    error_code: 0,
    message: '',
    data: paths,
  };
});

const downloadIng = [];
router.get('/api/download/downloading', async (ctx, next) => {
  return ctx.body = {
    message: '',
    data: downloadIng,
    error_code: 0,
  }
});

router.post('/api/download/create', koaBody(), async (ctx, next) => {
  const body = ctx.request.body;
  const stream = download(body.url);
  const tmpFile = path.join(TMP_DIR, Date.now().toString(), path.basename(body.url));
  const saveFile = path.join(SAVE_DIR, Date.now().toString(), path.basename(body.url));

  await fse.ensureDir(path.dirname(tmpFile));
  stream.pipe(fs.createWriteStream(tmpFile));
  stream.on('end', async () => {
    try {
      await fse.ensureDir(path.dirname(saveFile));
      await fse.move(tmpFile, saveFile);
      const i = downloadIng.findIndex((n) => n.id === saveFile);
      downloadIng.splice(i, 1);
    } catch (err) {
      throw err;
    }
  });

  downloadIng.push({
    url: body.url,
    id: saveFile,
    createdAt: moment().format('YYYY-MM-DD HH:mm:ss'),
  });

  ctx.body = {
    message: '任务创建成功!',
    error_code: 0,
    data: null
  };
});

router.post(
  '/api/upload/create',
  koaBody({
    multipart: true,
    formidable: {
      keepExtensions: true,
    },
  }),
  async (ctx, next) => {
    const files = ctx.request.files;
    await fse.move(files.file.path, path.join(SAVE_DIR, Date.now().toString(), `${files.file.name.replace(/\s+/g, '-')}`))
    ctx.body = {
      message: '上传成功!',
      error_code: 0,
      data: null,
    };
  }
)

app
  .use(router.routes())
  .use(router.allowedMethods())

app.listen(3000);
