const https = require('https');
const isbn = '9784042224314'; // イリヤの空 その4

// OpenBD
https.get(`https://api.openbd.jp/v1/get?isbn=${isbn}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('OpenBD:', data.slice(0, 200)));
});

// Google Books
https.get(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Google Books:', JSON.parse(data).items?.[0]?.volumeInfo?.publishedDate));
});

// NDL
https.get(`https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${isbn}`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const match = data.match(/<dc:date>(.*?)<\/dc:date>/);
        console.log('NDL:', match ? match[1] : 'Not found');
    });
});
