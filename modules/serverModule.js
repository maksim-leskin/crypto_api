import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import url from 'node:url';

const NOT_FOUND_MESSAGE = 'Не найдено';
const SERVER_ERROR_MESSAGE = 'Внутренняя ошибка сервера';
const SUCCESS_ADD_MESSAGE = 'Валюта успешно добавлена';
const SUCCESS_DELETE_MESSAGE = 'Валюта успешно удалена';
const INVALID_REQUEST_MESSAGE = 'Неверный запрос';
const QUOTES_FILE = process.env.QUOTES_FILE;
const TICKERS_FILE = process.env.TICKERS_FILE;

const handleStepQuery = (res, quotesData, queryStep) => {
  const step = parseInt(queryStep);
  if (step && step > 0) {
    const lastValuesData = {};

    Object.keys(quotesData).forEach(ticker => {
      const values = quotesData[ticker];

      const slicedValues = values.slice(-step);
      lastValuesData[ticker] = step < values.length ? slicedValues : values;
    });

    res.end(JSON.stringify(lastValuesData));
    return;
  }
  res.end(JSON.stringify(quotesData));
};

const handleCryptoRequest = async (res, query) => {
  try {
    const fileDate = await readFile(QUOTES_FILE, 'utf8');

    res.writeHead(200, { 'Content-Type': 'application/json' });

    const quotesData = JSON.parse(fileDate);
    if (query.tickers) {
      const tickers = query.tickers.toUpperCase().split(',');
      const filteredData = {};
      tickers.forEach(ticker => {
        if (Object.prototype.hasOwnProperty.call(quotesData, ticker)) {
          filteredData[ticker] = quotesData[ticker];
        }
      });
      return handleStepQuery(res, filteredData, query.step);
    }
    handleStepQuery(res, quotesData, query.step);
  } catch (err) {
    console.error(`Ошибка при чтении файла: ${err.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: SERVER_ERROR_MESSAGE }));
  }
};

const handleAddTickers = (req, res, tickers, validTickers) => {
  const lengthTickers = tickers.length;

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    const userTickers = [];

    const data = JSON.parse(body.toUpperCase());

    if (typeof data === 'string') {
      userTickers.push(data);
    }

    if (Array.isArray(data)) {
      userTickers.push(...data);
    }

    userTickers.forEach(ticker => {
      if (validTickers.includes(ticker) && !tickers.includes(ticker)) {
        tickers.push(ticker);
      }
    });

    if (tickers.length !== lengthTickers) {
      try {
        await writeFile(TICKERS_FILE, JSON.stringify(tickers));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: SUCCESS_ADD_MESSAGE }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: SERVER_ERROR_MESSAGE }));
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: INVALID_REQUEST_MESSAGE }));
    }
  });
};

const handleRemoveTickers = async (res, tickers, query) => {
  const tickerLength = tickers.length;
  try {
    if (!query.tickers) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: INVALID_REQUEST_MESSAGE }));
      return;
    }

    const removeTicker = query.tickers.toUpperCase().split(',');

    const quotesFileData = await readFile(QUOTES_FILE, 'utf8');
    const quotesData = JSON.parse(quotesFileData);

    removeTicker.forEach(ticker => {
      const index = tickers.indexOf(ticker);
      if (index > -1) {
        tickers.splice(index, 1);
        delete quotesData[ticker];
      }
    });

    if (tickers.length !== tickerLength) {
      await writeFile(TICKERS_FILE, JSON.stringify(tickers));
      await writeFile(QUOTES_FILE, JSON.stringify(quotesData));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: SUCCESS_DELETE_MESSAGE }));
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: INVALID_REQUEST_MESSAGE }));
    }
  } catch (err) {
    console.error(`Ошибка при удалении данных: ${err.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: SERVER_ERROR_MESSAGE }));
  }
};

export const startServer = (tickers, validTickers) => {
  const server = http.createServer((req, res) => {
    const { pathname, query } = url.parse(req.url, true);

    if (pathname.startsWith('/crypto') && req.method === 'GET') {
      handleCryptoRequest(res, query);
      return;
    }

    if (pathname.startsWith('/crypto') && req.method === 'POST') {
      handleAddTickers(req, res, tickers, validTickers);
      return;
    }

    if (pathname.startsWith('/crypto') && req.method === 'DELETE') {
      handleRemoveTickers(res, tickers, query);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: NOT_FOUND_MESSAGE }));
  });
  return server;
};
