import { readFile, writeFile } from 'node:fs/promises';
import https from 'node:https';

const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;
const TSYMS = process.env.TSYMS;
const QUOTES_FILE = process.env.QUOTES_FILE;
const TICKERS_URL = 'data/all/coinlist?summary=true';
const PRICE_URL = 'data/pricemulti';
const MAX_QUOTES = process.env.MAX_QUOTES;

export const fetchUrlAsync = async url =>
  new Promise((resolve, reject) => {
    https.get(url, response => {
      let data = '';

      response.on('data', chunk => {
        data += chunk;
      });

      response.on('end', () => {
        resolve(data);
      });

      response.on('error', err => {
        reject(err);
      });
    });
  });

export const fetchValidTickers = async () => {
  try {
    const url = `${API_URL}${TICKERS_URL}`;
    const data = await fetchUrlAsync(url);
    const validTickers = Object.keys(JSON.parse(data).Data);
    return validTickers;
  } catch (err) {
    console.error(`Ошибка при получении данных: ${err.message}`);
  }
};

const fetchTickersData = async tickers => {
  try {
    const url = new URL(`${API_URL}${PRICE_URL}`);
    url.searchParams.set('tsyms', TSYMS);
    url.searchParams.set('api_key', API_KEY);
    url.searchParams.set('fsyms', tickers.join(','));

    const data = await fetchUrlAsync(url);
    return JSON.parse(data);
  } catch (err) {
    console.error(`Ошибка при получении данных: ${err.message}`);
  }
};

const createTimestampedData = tickersData => {
  const timestampedData = {};
  const timestamp = Date.now();

  const tsyms = TSYMS.split(',');

  for (const currency in tickersData) {
    timestampedData[currency] = {
      timestamp,
    };

    tsyms.forEach(tsym => {
      timestampedData[currency][`price_${tsym}`] = tickersData[currency][tsym];
    });
  }

  return timestampedData;
};

const storeQuotesData = async data => {
  try {
    const fileData = await readFile(QUOTES_FILE, 'utf-8');
    const quotesData = JSON.parse(fileData);

    for (const currency in data) {
      if (Object.hasOwnProperty.call(data, currency)) {
        if (!Object.hasOwnProperty.call(quotesData, currency)) {
          quotesData[currency] = [];
        }
        quotesData[currency].push(data[currency]);
      }
    }

    for (const currency in quotesData) {
      if (Object.hasOwnProperty.call(quotesData, currency)) {
        if (quotesData[currency].length > MAX_QUOTES) {
          quotesData[currency].shift();
        }
      }
    }

    try {
      await writeFile(QUOTES_FILE, JSON.stringify(quotesData));
    } catch (err) {
      console.error(`Ошибка при записи данных из файла: ${err.message}`);
    }
  } catch (err) {
    console.error(`Ошибка при чтении данных из файла: ${err.message}`);
  }
};

export const fetchAndStoreData = async tickers => {
  const tickersData = await fetchTickersData(tickers);
  console.log('tickersData: ', tickersData);
  const timestampedData = createTimestampedData(tickersData);
  storeQuotesData(timestampedData);
};
