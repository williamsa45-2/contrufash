const url = 'http://localhost:3000';
(async () => {
  try {
    const res = await fetch(url);
    console.log('status', res.status);
    const body = await res.text();
    console.log('body len', body.length);
  } catch (err) {
    console.error('ERR', err.stack || err.message);
  }
})();