
// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

console.log('keys:==>', keys);

// Postgres Client Setup
const { Pool } = require('pg');

const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

console.log('keys: ==>', keys);

pgClient.on('error', () => console.log('Lost PG connection'));
pgClient.on('connect', () => console.log('CONNECTED TO PG: ok'));
pgClient.on('acquire', () => console.log('PG: ACQUIRED'));

pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.log('An error ocurred creating table', err));

// Redis Client Setup
const redis = require('redis');
const keys = require('./keys');

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  console.log('Getting all values from PG');
  const values = await pgClient.query('SELECT * from values');
  console.log('values OK', values);

  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  console.log('getting current value from Redis');

  redisClient.hgetall('values', (err, values) => {
    console.log('REDIS OK');
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const { index } = req.body;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }

  redisClient.hset('values', index, 'Nothing yet!');
  console.log('Publishing index', index);
  redisPublisher.publish('insert', index);
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  res.send({ working: true });
});

app.listen(5000, (err) => {
  console.log('Listening');
});
